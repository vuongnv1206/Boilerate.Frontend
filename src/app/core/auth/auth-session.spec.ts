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
import { TokenResponse } from './auth.models';

const tokens: TokenResponse = {
  token: 'first-access',
  refreshToken: 'first-refresh',
  sessionId: 'session-id',
  accessTokenExpiresAt: '2026-10-20T12:15:00Z',
  refreshTokenExpiryTime: '2026-11-20T12:00:00Z',
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
    const login = requests.expectOne('/api/tokens/get');
    expect(login.request.headers.has('Authorization')).toBe(false);
    login.flush(tokens);
    const permissions = requests.expectOne('/api/personal/permissions');
    expect(permissions.request.headers.get('Authorization')).toBe('Bearer first-access');
    permissions.flush(['Permissions.Product.View']);
  }

  it('signs in through the BE endpoints and reads the actual permissions', () => {
    signIn();
    expect(session.signedIn()).toBe(true);
    expect(session.hasPermission('Permissions.Product.View')).toBe(true);
    expect(session.hasPermission('Permissions.Product.Create')).toBe(false);
  });

  it('sends one refresh for concurrent 401 responses, then retries with the new token', () => {
    signIn();
    const first = vi.fn();
    const second = vi.fn();
    http.get('/api/categories').subscribe(first);
    http.get('/api/product-types').subscribe(second);
    requests.expectOne('/api/categories').flush({}, { status: 401, statusText: 'Unauthorized' });
    requests.expectOne('/api/product-types').flush({}, { status: 401, statusText: 'Unauthorized' });
    const refresh = requests.expectOne('/api/tokens/refresh');
    expect(refresh.request.body).toEqual({ refreshToken: 'first-refresh' });
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush({ ...tokens, token: 'next-access', refreshToken: 'next-refresh' });
    for (const url of ['/api/categories', '/api/product-types']) {
      const retry = requests.expectOne(url);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer next-access');
      retry.flush([]);
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
    const refresh = requests.expectOne('/api/tokens/refresh');
    session.signOut().subscribe();
    requests.expectOne('/api/tokens/sessions/session-id').flush(null);
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
    requests.expectNone('/api/tokens/refresh');
    expect(session.signedIn()).toBe(true);
    http.get('/api/categories').subscribe({ error: () => undefined });
    requests.expectOne('/api/categories').flush({}, { status: 401, statusText: 'Unauthorized' });
    requests
      .expectOne('/api/tokens/refresh')
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
    requests
      .expectOne('/api/tokens/get')
      .flush({ ...tokens, token: 'second-user', sessionId: 'second-session' });
    requests.expectOne('/api/personal/permissions').flush(['Permissions.Product.View']);
    oldWrite.flush({}, { status: 401, statusText: 'Unauthorized' });
    requests.expectNone('/api/products');
    requests.expectNone('/api/tokens/refresh');
    expect(session.accessToken()).toBe('second-user');
    expect(session.signedIn()).toBe(true);
    expect(error).toHaveBeenCalledOnce();
  });

  it('clears an incomplete login when permission loading is cancelled', () => {
    const login = session
      .signIn({ email: 'admin@example.test', password: 'test password' })
      .subscribe();
    requests.expectOne('/api/tokens/get').flush(tokens);
    const permissions = requests.expectOne('/api/personal/permissions');
    expect(session.signedIn()).toBe(false);
    login.unsubscribe();
    expect(permissions.cancelled).toBe(true);
    expect(session.signedIn()).toBe(false);
    expect(session.accessToken()).toBeNull();
  });
});
