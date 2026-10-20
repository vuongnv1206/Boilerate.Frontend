import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideRuntimeConfig } from '../config/runtime-config.token';
import { ApiError } from './api-error';
import { apiErrorInterceptor, SKIP_API_ERROR_NORMALIZATION } from './api-error.interceptor';

describe('API error interceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRuntimeConfig({ apiBaseUrl: '/api' }),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('normalizes an API response once without retrying a failed write', () => {
    let received: unknown;
    client.post('/api/products', { name: 'Demo' }).subscribe({
      error: (error: unknown) => {
        received = error;
      },
    });
    const request = http.expectOne('/api/products');
    expect(request.request.method).toBe('POST');
    request.flush(
      { code: 'Product.VersionConflict', traceId: 'trace-42' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(received).toBeInstanceOf(ApiError);
    expect(received).toMatchObject({
      status: 409,
      kind: 'conflict',
      code: 'Product.VersionConflict',
      traceId: 'trace-42',
    });
    http.expectNone('/api/products');
  });

  it('normalizes transport failures and leaves successful responses unchanged', () => {
    let received: unknown;
    client.get('/api/products').subscribe({
      error: (error: unknown) => {
        received = error;
      },
    });
    http.expectOne('/api/products').error(new ProgressEvent('error'));
    expect(received).toMatchObject({ status: 0, kind: 'network' });

    let result: unknown;
    client.get('/api/products').subscribe((value: unknown) => {
      result = value;
    });
    http.expectOne('/api/products').flush({ data: [] });
    expect(result).toEqual({ data: [] });
  });

  it.each([
    '/images/logo.svg',
    '/runtime-config.js',
    '/api-backup/products',
    'https://outside.example.test/api/products',
  ])('leaves non-API errors unchanged: %s', (url) => {
    let received: unknown;
    client.get(url).subscribe({
      error: (error: unknown) => {
        received = error;
      },
    });
    http.expectOne(url).flush('missing', { status: 404, statusText: 'Not Found' });
    expect(received).toBeInstanceOf(HttpErrorResponse);
    expect(received).not.toBeInstanceOf(ApiError);
  });

  it('allows a caller to opt out when it handles a special response contract', () => {
    let received: unknown;
    client
      .get('/api/export', { context: new HttpContext().set(SKIP_API_ERROR_NORMALIZATION, true) })
      .subscribe({
        error: (error: unknown) => {
          received = error;
        },
      });
    http.expectOne('/api/export').flush('missing', { status: 404, statusText: 'Not Found' });
    expect(received).toBeInstanceOf(HttpErrorResponse);
  });
});
