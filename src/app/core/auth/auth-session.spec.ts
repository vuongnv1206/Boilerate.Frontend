import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideRuntimeConfig } from '../config/runtime-config.token';
import { apiErrorInterceptor } from '../http/api-error.interceptor';
import { SKIP_AUTH } from './auth-context';
import { AuthSession } from './auth-session';
import { authInterceptor } from './auth.interceptor';
import { TokenResponse } from './auth.dto';

const tokens: TokenResponse = {
  userId: 'first-user',
  token: 'first-access',
  sessionId: 'session-id',
  accessTokenExpiresAt: '2026-10-20T12:15:00Z',
};

describe('AuthSession and API authentication', () => {
  let http: HttpClient;
  let requests: HttpTestingController;
  let session: AuthSession;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRuntimeConfig({ apiBaseUrl: '/api' }),
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor, authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSession);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    requests.verify();
    TestBed.resetTestingModule();
  });

  function signIn(): void {
    session.signIn({ email: 'admin@example.test', password: 'test password' }).subscribe();
    const login = requests.expectOne('/api/tokens/session');
    expect(login.request.headers.has('Authorization')).toBe(false);
    expect(login.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(login.request.withCredentials).toBe(true);
    login.flush(tokens);
    const permissions = requests.expectOne('/api/personal/authorization');
    expect(permissions.request.headers.get('Authorization')).toBe('Bearer first-access');
    permissions.flush({ permissions: ['Permissions.Product.View'], isCentralAdmin: false });
  }

  it('normalizes codes and takes central administrator status only from the authorization response', () => {
    signIn();
    expect(session.can('product', 'VIEW')).toBe(true);
    expect(session.can('Product.View', 'View')).toBe(false);
    expect(session.isCentralAdmin()).toBe(false);
    session.reloadAuthorization().subscribe();
    requests
      .expectOne('/api/personal/authorization')
      .flush({ permissions: ['Permissions.Custom.APPROVE'], isCentralAdmin: true });
    expect(session.can('custom', 'approve')).toBe(true);
    expect(session.can('Product', 'View')).toBe(false);
    expect(session.isCentralAdmin()).toBe(true);
  });

  it('fails closed on a malformed authorization refresh and keeps the authenticated draft session', () => {
    signIn();
    session.reloadAuthorization().subscribe({ error: () => undefined });
    requests
      .expectOne('/api/personal/authorization')
      .flush({ permissions: ['Permissions.Product.View'], isCentralAdmin: 'true' });
    expect(session.can('Product', 'View')).toBe(false);
    expect(session.isCentralAdmin()).toBe(false);
    expect(session.signedIn()).toBe(true);
  });

  it('signs in through the BE endpoints and reads the actual permissions', () => {
    signIn();
    expect(session.signedIn()).toBe(true);
    expect(session.can('Product', 'View')).toBe(true);
    expect(session.can('Product', 'Create')).toBe(false);
  });

  it('rejects malformed permission responses without granting access', () => {
    const restored = vi.fn();
    session.restore().subscribe(restored);
    requests.expectOne('/api/tokens/session/refresh').flush(tokens);
    requests
      .expectOne('/api/personal/authorization')
      .flush({ grants: ['Permissions.Product.View'] });
    expect(restored).toHaveBeenCalledWith(false);
    expect(session.signedIn()).toBe(false);
    expect(session.can('Product', 'View')).toBe(false);
  });

  it('restores once for concurrent guards and waits for fresh permissions', () => {
    const first = vi.fn();
    const second = vi.fn();
    session.restore().subscribe(first);
    session.restore().subscribe(second);
    const refresh = requests.expectOne('/api/tokens/session/refresh');
    expect(refresh.request.body).toBeNull();
    expect(refresh.request.withCredentials).toBe(true);
    expect(refresh.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    refresh.flush(tokens);
    expect(session.signedIn()).toBe(false);
    expect(first).not.toHaveBeenCalled();
    requests
      .expectOne('/api/personal/authorization')
      .flush({ permissions: ['Permissions.Product.View'], isCentralAdmin: false });
    expect(first).toHaveBeenCalledWith(true);
    expect(second).toHaveBeenCalledWith(true);
    expect(session.signedIn()).toBe(true);
    session.restore().subscribe();
    requests.expectNone('/api/tokens/session/refresh');
  });

  it('handles a missing or revoked cookie without restoring a protected session', () => {
    const restored = vi.fn();
    session.restore().subscribe(restored);
    requests
      .expectOne('/api/tokens/session/refresh')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(restored).toHaveBeenCalledWith(false);
    expect(session.signedIn()).toBe(false);
    expect(session.accessToken()).toBeNull();
    expect(session.restoreError()).toBe('');
    requests.expectNone('/api/personal/authorization');
  });

  it('reports restore outages and can retry instead of treating the cookie as revoked', () => {
    session.restore().subscribe();
    requests
      .expectOne('/api/tokens/session/refresh')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(session.restoreError()).not.toBe('');
    session.restore().subscribe();
    requests.expectOne('/api/tokens/session/refresh').flush(tokens);
    requests
      .expectOne('/api/personal/authorization')
      .flush({ permissions: [], isCentralAdmin: false });
    expect(session.signedIn()).toBe(true);
    expect(session.restoreError()).toBe('');
  });

  it('revokes by cookie without relying on an access token and lets failed logout be retried', () => {
    session.signOut().subscribe();
    const logout = requests.expectOne('/api/tokens/session');
    expect(logout.request.method).toBe('DELETE');
    expect(logout.request.headers.has('Authorization')).toBe(false);
    expect(logout.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    logout.flush({}, { status: 503, statusText: 'Unavailable' });
    expect(session.logoutFailed()).toBe(true);
    expect(session.restoreError()).toContain('đăng xuất');
    session.signOut().subscribe();
    requests.expectOne('/api/tokens/session').flush(null);
    expect(session.logoutFailed()).toBe(false);
    expect(session.restoreError()).toBe('');
  });

  it('denies a failed authorization restore and lets the user restore again', () => {
    session.restore().subscribe();
    requests.expectOne('/api/tokens/session/refresh').flush(tokens);
    requests
      .expectOne('/api/personal/authorization')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(session.signedIn()).toBe(false);
    expect(session.restoreError()).not.toBe('');
    session.restore().subscribe();
    requests.expectOne('/api/tokens/session/refresh').flush(tokens);
    requests
      .expectOne('/api/personal/authorization')
      .flush({ permissions: [], isCentralAdmin: false });
    expect(session.signedIn()).toBe(true);
  });

  it('sends one refresh for concurrent 401 responses, then retries with the new token', () => {
    signIn();
    const first = vi.fn();
    const second = vi.fn();
    http.get('/api/categories').subscribe(first);
    http.get('/api/product-types').subscribe(second);
    requests.expectOne('/api/categories').flush({}, { status: 401, statusText: 'Unauthorized' });
    requests.expectOne('/api/product-types').flush({}, { status: 401, statusText: 'Unauthorized' });
    const refresh = requests.expectOne('/api/tokens/session/refresh');
    expect(refresh.request.body).toBeNull();
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush({ ...tokens, token: 'next-access' });
    requests
      .expectOne('/api/personal/authorization')
      .flush({ permissions: ['Permissions.Product.View'], isCentralAdmin: false });
    for (const url of ['/api/categories', '/api/product-types']) {
      const retry = requests.expectOne(url);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer next-access');
      retry.flush({ permissions: [], isCentralAdmin: false });
    }
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it('does not send tokens to another origin, outside the API path or to skipped requests', () => {
    signIn();
    for (const url of [
      'https://other.example/api/products',
      '/api-other/products',
      '/images/logo.svg',
    ]) {
      http.get(url).subscribe();
      const request = requests.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
    }
    http.get('/api/public', { context: new HttpContext().set(SKIP_AUTH, true) }).subscribe();
    const skipped = requests.expectOne('/api/public');
    expect(skipped.request.headers.has('Authorization')).toBe(false);
    skipped.flush({});
  });

  it('keeps a late refresh from restoring a session after signing out', () => {
    signIn();
    const error = vi.fn();
    session.refresh().subscribe({ error });
    const refresh = requests.expectOne('/api/tokens/session/refresh');
    session.signOut().subscribe();
    requests.expectOne('/api/tokens/session').flush(null);
    refresh.flush({ ...tokens, token: 'late-token' });
    expect(session.signedIn()).toBe(false);
    expect(session.permissions()).toEqual([]);
    expect(error).toHaveBeenCalledOnce();
  });

  it('clears the session when refresh fails and does not retry a forbidden request', () => {
    signIn();
    const forbidden = vi.fn();
    http.post('/api/products', {}).subscribe({ error: forbidden });
    requests.expectOne('/api/products').flush({}, { status: 403, statusText: 'Forbidden' });
    requests
      .expectOne('/api/personal/authorization')
      .flush({ permissions: [], isCentralAdmin: false });
    requests.expectNone('/api/tokens/session/refresh');
    expect(session.signedIn()).toBe(true);
    http.get('/api/categories').subscribe({ error: () => undefined });
    requests.expectOne('/api/categories').flush({}, { status: 401, statusText: 'Unauthorized' });
    requests
      .expectOne('/api/tokens/session/refresh')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(session.signedIn()).toBe(false);
    expect(forbidden).toHaveBeenCalledOnce();
  });

  it('does not retry an old request with another user token', () => {
    signIn();
    const error = vi.fn();
    http.post('/api/products', { name: 'First user request' }).subscribe({ error });
    const oldWrite = requests.expectOne('/api/products');
    session.clear();
    session.signIn({ email: 'second@example.test', password: 'test password' }).subscribe();
    requests.expectOne('/api/tokens/session').flush({
      ...tokens,
      userId: 'second-user',
      token: 'second-user',
      sessionId: 'second-session',
    });
    requests
      .expectOne('/api/personal/authorization')
      .flush({ permissions: ['Permissions.Product.View'], isCentralAdmin: false });
    oldWrite.flush({}, { status: 401, statusText: 'Unauthorized' });
    requests.expectNone('/api/products');
    requests.expectNone('/api/tokens/session/refresh');
    expect(session.accessToken()).toBe('second-user');
    expect(session.signedIn()).toBe(true);
    expect(error).toHaveBeenCalledOnce();
  });

  it('does not replay a write if another tab changed the cookie account before its message arrives', () => {
    signIn();
    const error = vi.fn();
    http.post('/api/products', { name: 'First user change' }).subscribe({ error });
    requests.expectOne('/api/products').flush({}, { status: 401, statusText: 'Unauthorized' });
    requests
      .expectOne('/api/tokens/session/refresh')
      .flush({ ...tokens, userId: 'second-user', token: 'other-access' });
    requests.expectNone('/api/products');
    expect(session.accessToken()).toBeNull();
    expect(session.permissions()).toEqual([]);
    expect(session.restoreError()).toContain('Tài khoản');
    expect(error).toHaveBeenCalledOnce();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledOnce();
  });

  it('clears an incomplete login when permission loading is cancelled', () => {
    const login = session
      .signIn({ email: 'admin@example.test', password: 'test password' })
      .subscribe();
    requests.expectOne('/api/tokens/session').flush(tokens);
    const permissions = requests.expectOne('/api/personal/authorization');
    expect(session.signedIn()).toBe(false);
    login.unsubscribe();
    expect(permissions.cancelled).toBe(true);
    expect(session.signedIn()).toBe(false);
    expect(session.accessToken()).toBeNull();
  });
});
