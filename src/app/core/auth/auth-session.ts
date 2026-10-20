import { HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { ApiClient } from '../http/api-client';
import { SKIP_AUTH } from './auth-context';
import { LoginRequest, TokenResponse } from './auth.models';

/** Tokens stay in memory. Reloading the page requires signing in again. */
@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly api = inject(ApiClient);
  private readonly tokens = signal<TokenResponse | null>(null);
  private readonly ready = signal(false);
  private readonly grantedPermissions = signal<readonly string[]>([]);
  private refreshRequest: Observable<string> | null = null;
  private sessionVersion = 0;

  readonly accessToken = computed(() => this.tokens()?.token ?? null);
  readonly signedIn = computed(() => this.ready() && this.tokens() !== null);
  readonly permissions = this.grantedPermissions.asReadonly();

  signIn(request: LoginRequest): Observable<void> {
    this.clear();
    const version = this.sessionVersion;
    let completed = false;
    return this.api.post<TokenResponse>('tokens/get', request, this.anonymous()).pipe(
      tap((tokens) => this.setTokens(tokens, version)),
      switchMap(() => this.api.get<string[]>('personal/permissions')),
      tap((permissions) => {
        if (version !== this.sessionVersion) throw new Error('Lần đăng nhập này đã kết thúc.');
        this.grantedPermissions.set(permissions);
        this.ready.set(true);
        completed = true;
      }),
      map(() => undefined),
      catchError((error: unknown) => {
        if (version === this.sessionVersion) this.clear();
        return throwError(() => error);
      }),
      finalize(() => {
        if (!completed && version === this.sessionVersion) this.clear();
      }),
    );
  }

  refresh(): Observable<string> {
    if (this.refreshRequest) return this.refreshRequest;
    const tokens = this.tokens();
    if (!tokens) return throwError(() => new Error('Vui lòng đăng nhập lại.'));
    const version = this.sessionVersion;
    const request = this.api
      .post<TokenResponse>(
        'tokens/refresh',
        { refreshToken: tokens.refreshToken },
        this.anonymous(),
      )
      .pipe(
        tap((response) => this.setTokens(response, version)),
        map((response) => response.token),
        finalize(() => {
          if (this.refreshRequest === request) this.refreshRequest = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    this.refreshRequest = request;
    return request;
  }

  signOut(): Observable<void> {
    const tokens = this.tokens();
    this.clear();
    if (!tokens) return of(undefined);
    return this.api
      .delete<void>(`tokens/sessions/${tokens.sessionId}`, {
        ...this.anonymous(),
        headers: { Authorization: `Bearer ${tokens.token}` },
      })
      .pipe(catchError(() => of(undefined)));
  }

  clear(): void {
    this.sessionVersion += 1;
    this.tokens.set(null);
    this.ready.set(false);
    this.grantedPermissions.set([]);
    this.refreshRequest = null;
  }

  hasPermission(permission: string): boolean {
    return this.grantedPermissions().includes(permission);
  }

  getVersion(): number {
    return this.sessionVersion;
  }

  private setTokens(tokens: TokenResponse, version: number): void {
    if (version !== this.sessionVersion) throw new Error('Phiên đăng nhập đã kết thúc.');
    if (!tokens.token || !tokens.refreshToken || !tokens.sessionId) {
      throw new Error('Máy chủ trả về phiên đăng nhập không hợp lệ.');
    }
    this.tokens.set(tokens);
  }

  private anonymous(): { context: HttpContext } {
    return { context: new HttpContext().set(SKIP_AUTH, true) };
  }
}
