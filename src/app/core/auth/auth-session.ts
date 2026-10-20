import { DOCUMENT } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  defer,
  finalize,
  firstValueFrom,
  from,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { ApiClient, ApiRequestOptions } from '../http/api-client';
import { normalizeApiError } from '../http/normalize-api-error';
import { SKIP_AUTH } from './auth-context';
import { LoginRequest, TokenResponse } from './auth.models';

/** The refresh cookie belongs to the server. Access tokens stay in memory. */
@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly api = inject(ApiClient);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly tokens = signal<TokenResponse | null>(null);
  private readonly ready = signal(false);
  private readonly grantedPermissions = signal<readonly string[]>([]);
  private readonly restoreFailure = signal('');
  private readonly logoutFailure = signal(false);
  private readonly channel = this.document.defaultView?.BroadcastChannel
    ? new this.document.defaultView.BroadcastChannel('boilerate-session')
    : null;
  private refreshRequest: Observable<string> | null = null;
  private restoreRequest: Observable<boolean> | null = null;
  private sessionVersion = 0;

  readonly accessToken = computed(() => this.tokens()?.token ?? null);
  readonly signedIn = computed(() => this.ready() && this.tokens() !== null);
  readonly permissions = this.grantedPermissions.asReadonly();
  readonly restoreError = this.restoreFailure.asReadonly();
  readonly logoutFailed = this.logoutFailure.asReadonly();

  constructor() {
    if (this.channel) {
      this.channel.onmessage = (event: MessageEvent<unknown>) => {
        if (event.data !== 'login' && event.data !== 'logout') return;
        const returnUrl = this.router.url;
        this.clear();
        if (returnUrl.startsWith('/admin')) {
          void this.router.navigate(['/login'], { queryParams: { returnUrl } });
        }
      };
    }
    inject(DestroyRef).onDestroy(() => this.channel?.close());
  }

  signIn(request: LoginRequest): Observable<void> {
    this.clear();
    const version = this.sessionVersion;
    let completed = false;
    return this.withSessionLock(() => {
      this.checkVersion(version);
      return this.api.post<TokenResponse>('tokens/session', request, this.browserOptions()).pipe(
        tap((tokens) => {
          this.setTokens(tokens, version);
          this.channel?.postMessage('login');
        }),
      );
    }).pipe(
      switchMap(() => this.loadPermissions(version)),
      tap(() => {
        completed = true;
      }),
      catchError((error: unknown) => {
        if (version === this.sessionVersion) this.clear();
        return throwError(() => error);
      }),
      finalize(() => {
        if (!completed && version === this.sessionVersion) this.clear();
      }),
    );
  }

  restore(): Observable<boolean> {
    if (this.signedIn()) return of(true);
    if (this.restoreRequest) return this.restoreRequest;
    const version = this.sessionVersion;
    const request = this.refresh().pipe(
      switchMap(() => this.loadPermissions(version)),
      map(() => true),
      catchError((error: unknown) => {
        if (version === this.sessionVersion) {
          this.clear();
          if (normalizeApiError(error).status !== 401) {
            this.restoreFailure.set('Không thể kiểm tra phiên đăng nhập. Vui lòng thử lại.');
          }
        }
        return of(false);
      }),
      finalize(() => {
        if (this.restoreRequest === request) this.restoreRequest = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.restoreRequest = request;
    return request;
  }

  refresh(): Observable<string> {
    if (this.refreshRequest) return this.refreshRequest;
    const version = this.sessionVersion;
    const userId = this.tokens()?.userId;
    const request = this.withSessionLock(() => {
      this.checkVersion(version);
      return this.api
        .post<TokenResponse>('tokens/session/refresh', null, this.browserOptions())
        .pipe(
          tap((response) => this.setTokens(response, version, userId)),
          map((response) => response.token),
        );
    }).pipe(
      finalize(() => {
        if (this.refreshRequest === request) this.refreshRequest = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.refreshRequest = request;
    return request;
  }

  signOut(): Observable<void> {
    this.clear();
    this.channel?.postMessage('logout');
    // Wait for an in-flight refresh, then revoke its newest cookie.
    return this.withSessionLock(() =>
      this.api.delete<void>('tokens/session', this.browserOptions()),
    ).pipe(
      catchError(() => {
        this.logoutFailure.set(true);
        this.restoreFailure.set('Chưa thể đăng xuất khỏi máy chủ. Vui lòng thử lại.');
        return of(undefined);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }

  clear(): void {
    this.sessionVersion += 1;
    this.tokens.set(null);
    this.ready.set(false);
    this.grantedPermissions.set([]);
    this.restoreFailure.set('');
    this.logoutFailure.set(false);
    this.refreshRequest = null;
    this.restoreRequest = null;
  }

  hasPermission(permission: string): boolean {
    return this.grantedPermissions().includes(permission);
  }

  getVersion(): number {
    return this.sessionVersion;
  }

  private loadPermissions(version: number): Observable<void> {
    this.checkVersion(version);
    return this.api.get<string[]>('personal/permissions').pipe(
      tap((permissions) => {
        this.checkVersion(version);
        this.grantedPermissions.set(permissions);
        this.ready.set(true);
        this.restoreFailure.set('');
      }),
      map(() => undefined),
    );
  }

  private setTokens(tokens: TokenResponse, version: number, expectedUserId?: string): void {
    this.checkVersion(version);
    if (
      !tokens.userId ||
      !tokens.token ||
      !tokens.sessionId ||
      !Number.isFinite(Date.parse(tokens.accessTokenExpiresAt))
    ) {
      throw new Error('Máy chủ trả về phiên đăng nhập không hợp lệ.');
    }
    if (expectedUserId && tokens.userId !== expectedUserId) {
      this.clear();
      this.restoreFailure.set('Tài khoản đã thay đổi ở tab khác. Vui lòng đăng nhập lại.');
      void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      throw new Error('Không gửi lại yêu cầu bằng tài khoản khác.');
    }
    this.tokens.set(tokens);
  }

  private checkVersion(version: number): void {
    if (version !== this.sessionVersion) throw new Error('Phiên đăng nhập đã kết thúc.');
  }

  private browserOptions(): ApiRequestOptions {
    return {
      context: new HttpContext().set(SKIP_AUTH, true),
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      withCredentials: true,
    };
  }

  private withSessionLock<T>(request: () => Observable<T>): Observable<T> {
    const locks = this.document.defaultView?.navigator.locks;
    return locks
      ? defer(() => from(locks.request('boilerate-session', () => firstValueFrom(request()))))
      : defer(request);
  }
}
