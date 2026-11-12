import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  MonoTypeOperatorFunction,
  Observable,
  Subject,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  takeUntil,
  tap,
  throwError,
  throwIfEmpty,
} from 'rxjs';
import { normalizeApiError } from '../http/normalize-api-error';
import { AuthApi } from './auth-api';
import { ExternalLoginEndpoint, LoginRequest, TokenResponse } from './auth.dto';
import { SessionSync } from './session-sync';

interface SessionState {
  readonly tokens: TokenResponse | null;
  readonly permissions: readonly string[];
  readonly isCentralAdmin: boolean;
  readonly error: string;
  readonly logoutFailed: boolean;
}

const SIGNED_OUT: SessionState = {
  tokens: null,
  permissions: [],
  isCentralAdmin: false,
  error: '',
  logoutFailed: false,
};

/**
 * The signed-in session. The access token lives in memory only; the refresh cookie belongs to the
 * server. Tokens and permissions are always set together, so the session is either complete or
 * signed out.
 */
@Injectable({ providedIn: 'root' })
export class AuthSession {
  // System variables
  private readonly state = signal(SIGNED_OUT);
  /** Fires on every `clear()`; requests of the ended session stop instead of writing stale state. */
  private readonly sessionEnded$ = new Subject<void>();
  private readonly pending = new Map<string, Observable<unknown>>();
  private readonly permissionIndex = computed(
    () => new Set(this.state().permissions.map((permission) => permission.toUpperCase())),
  );

  // Business variables
  readonly accessToken = computed(() => this.state().tokens?.token ?? null);
  readonly userId = computed(() => this.state().tokens?.userId ?? null);
  readonly sessionId = computed(() => this.state().tokens?.sessionId ?? null);
  readonly signedIn = computed(() => this.state().tokens !== null);
  readonly permissions = computed(() => this.state().permissions);
  readonly isCentralAdmin = computed(() => this.state().isCentralAdmin);
  readonly restoreError = computed(() => this.state().error);
  readonly logoutFailed = computed(() => this.state().logoutFailed);

  constructor(
    private readonly authApi: AuthApi,
    private readonly sync: SessionSync,
    private readonly router: Router,
  ) {
    this.sync.onEvent((event) => {
      if (event === 'authorization-changed') {
        this.reloadAuthorization().subscribe({ error: () => undefined });
        return;
      }
      // Another tab signed out.
      const returnUrl = this.router.url;
      this.clear();
      if (returnUrl.startsWith('/admin')) {
        void this.router.navigate(['/login'], { queryParams: { returnUrl } });
      }
    });
  }

  signIn(request: LoginRequest): Observable<void> {
    this.clear();
    return this.openSession(() => this.authApi.login(request)).pipe(map(() => undefined));
  }

  signInExternal(endpoint: ExternalLoginEndpoint, payload: unknown): Observable<void> {
    this.clear();
    return this.openSession(() => this.authApi.loginExternal(endpoint, payload)).pipe(
      map(() => undefined),
    );
  }

  /** Used on page load: turns the refresh cookie back into a session. Emits whether it worked. */
  restore(): Observable<boolean> {
    if (this.signedIn()) return of(true);
    return this.refresh().pipe(
      map(() => true),
      catchError((error: unknown) => {
        if (normalizeApiError(error).status !== 401) {
          this.fail('Không thể kiểm tra phiên đăng nhập. Vui lòng thử lại.');
        }
        return of(false);
      }),
    );
  }

  /** Emits the new access token. Concurrent callers share one request. */
  refresh(): Observable<string> {
    const userId = this.userId();
    return this.shared('refresh', () => this.openSession(() => this.authApi.refresh(), userId));
  }

  signOut(): Observable<void> {
    this.clear();
    this.sync.notify('logout');
    // The lock waits for a refresh still in flight, so the newest cookie is the one revoked.
    return this.sync
      .withLock(() => this.authApi.logout())
      .pipe(
        catchError(() => {
          this.fail('Chưa thể đăng xuất khỏi máy chủ. Vui lòng thử lại.', true);
          return of(undefined);
        }),
      );
  }

  /** The server no longer accepts this session: sign out locally and ask to sign in again. */
  expire(message = ''): void {
    const returnUrl = this.router.url;
    this.clear();
    if (message) this.fail(message);
    void this.router.navigate(['/login'], { queryParams: { returnUrl } });
  }

  can(functionCode: string, actionCode: string): boolean {
    return this.permissionIndex().has(`Permissions.${functionCode}.${actionCode}`.toUpperCase());
  }

  /** Re-reads permissions for the current token. Concurrent callers share one request. */
  reloadAuthorization(): Observable<void> {
    const token = this.accessToken();
    if (!token) return of(undefined);
    return this.shared('authorization', () =>
      this.authApi.getAuthorization(token).pipe(
        this.untilSessionEnds(),
        tap(({ permissions, isCentralAdmin }) =>
          this.state.update((state) => ({ ...state, permissions, isCentralAdmin })),
        ),
        map(() => undefined),
        catchError((error: unknown) => {
          // Unknown permissions mean no permissions.
          this.state.update((state) => ({ ...state, permissions: [], isCentralAdmin: false }));
          return throwError(() => error);
        }),
      ),
    );
  }

  /** Call after a write that changes permissions: updates this tab and tells the others. */
  authorizationChanged(): Observable<void> {
    this.sync.notify('authorization-changed');
    return this.reloadAuthorization();
  }

  private clear(): void {
    // Stop in-flight requests first, so whatever they report is wiped by the reset below.
    this.sessionEnded$.next();
    this.state.set(SIGNED_OUT);
  }

  private fail(error: string, logoutFailed = false): void {
    this.state.update((state) => ({ ...state, error, logoutFailed }));
  }

  /** Fetches tokens, then their permissions, and only then stores both. Emits the access token. */
  private openSession(
    fetchTokens: () => Observable<TokenResponse>,
    expectedUserId: string | null = null,
  ): Observable<string> {
    return this.sync.withLock(fetchTokens).pipe(
      tap((tokens) => {
        // Ending the session here makes `untilSessionEnds` below fail this request.
        if (expectedUserId && tokens.userId !== expectedUserId) {
          this.expire('Tài khoản đã thay đổi ở tab khác. Vui lòng đăng nhập lại.');
        }
      }),
      switchMap((tokens) =>
        this.authApi
          .getAuthorization(tokens.token)
          .pipe(map((authorization) => ({ tokens, authorization }))),
      ),
      this.untilSessionEnds(),
      map(({ tokens, authorization }) => {
        this.state.set({
          ...SIGNED_OUT,
          tokens,
          permissions: authorization.permissions,
          isCentralAdmin: authorization.isCentralAdmin,
        });
        return tokens.token;
      }),
    );
  }

  private untilSessionEnds<T>(): MonoTypeOperatorFunction<T> {
    return (source) =>
      source.pipe(
        takeUntil(this.sessionEnded$),
        throwIfEmpty(() => new Error('Phiên đăng nhập đã kết thúc.')),
      );
  }

  private shared<T>(key: 'refresh' | 'authorization', request: () => Observable<T>): Observable<T> {
    const running = this.pending.get(key) as Observable<T> | undefined;
    if (running) return running;
    const started = request().pipe(
      finalize(() => this.pending.delete(key)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.pending.set(key, started);
    return started;
  }
}
