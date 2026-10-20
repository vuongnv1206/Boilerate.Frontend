import {
  HttpContext,
  HttpContextToken,
  HttpHeaders,
  HttpParams,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RUNTIME_CONFIG, provideRuntimeConfig } from '../config/runtime-config.token';
import { ApiClient, ApiMethod } from './api-client';
import { ApiError } from './api-error';
import { apiErrorInterceptor } from './api-error.interceptor';

describe('API client transport', () => {
  let client: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRuntimeConfig({ apiBaseUrl: '/api/v1' }),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    client = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('joins the runtime base and keeps typed JSON responses and query options', () => {
    const marker = new HttpContextToken<string>(() => 'unset');
    let result: { total: number } | undefined;
    client
      .get<{ total: number }>('catalog/products', {
        params: { page: 1, pageSize: 10, search: 'đèn bàn', statuses: ['draft', 'published'] },
        headers: new HttpHeaders({ Accept: 'application/json' }),
        context: new HttpContext().set(marker, 'content'),
      })
      .subscribe((value) => {
        result = value;
      });
    const request = http.expectOne((value) => value.url === '/api/v1/catalog/products');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('search')).toBe('đèn bàn');
    expect(request.request.params.getAll('statuses')).toEqual(['draft', 'published']);
    expect(request.request.context.get(marker)).toBe('content');
    expect(request.request.headers.get('Accept')).toBe('application/json');
    expect(request.request.responseType).toBe('json');
    request.flush({ total: 3 });
    expect(result).toEqual({ total: 3 });
  });

  it('keeps concurrent feature requests independent without mutating shared configuration', () => {
    const config = Object.freeze(TestBed.inject(RUNTIME_CONFIG));
    const productsOptions = Object.freeze({
      params: Object.freeze({ page: 2, search: 'đèn bàn' }),
      headers: Object.freeze({ 'X-Workspace': 'products' }),
    });
    const categoriesOptions = Object.freeze({
      params: Object.freeze({ page: 1, includeArchived: false }),
      headers: Object.freeze({ 'X-Workspace': 'categories', 'X-View': 'tree' }),
    });
    let products: { items: { id: string }[]; total: number } | undefined;
    let categories: { groups: string[] } | undefined;

    client
      .get<{ items: { id: string }[]; total: number }>('catalog/products', productsOptions)
      .subscribe((value) => {
        products = value;
      });
    client.get<{ groups: string[] }>('catalog/categories', categoriesOptions).subscribe((value) => {
      categories = value;
    });

    const productsRequest = http.expectOne((value) => value.url === '/api/v1/catalog/products');
    const categoriesRequest = http.expectOne((value) => value.url === '/api/v1/catalog/categories');
    expect(productsRequest.request.params.keys()).toEqual(['page', 'search']);
    expect(productsRequest.request.params.get('page')).toBe('2');
    expect(productsRequest.request.params.get('search')).toBe('đèn bàn');
    expect(productsRequest.request.headers.get('X-Workspace')).toBe('products');
    expect(productsRequest.request.headers.has('X-View')).toBe(false);
    expect(categoriesRequest.request.params.keys()).toEqual(['page', 'includeArchived']);
    expect(categoriesRequest.request.params.get('page')).toBe('1');
    expect(categoriesRequest.request.params.get('includeArchived')).toBe('false');
    expect(categoriesRequest.request.headers.get('X-Workspace')).toBe('categories');
    expect(categoriesRequest.request.headers.get('X-View')).toBe('tree');

    // Completing the later request first must not replace the other feature's response.
    categoriesRequest.flush({ groups: ['Phụ kiện'] });
    expect(categories?.groups).toEqual(['Phụ kiện']);
    expect(products).toBeUndefined();
    productsRequest.flush({ items: [{ id: 'product-1' }], total: 14 });
    expect(products).toEqual({ items: [{ id: 'product-1' }], total: 14 });
    expect(categories).toEqual({ groups: ['Phụ kiện'] });
    expect(config).toEqual({ apiBaseUrl: '/api/v1' });
    expect(productsOptions).toEqual({
      params: { page: 2, search: 'đèn bàn' },
      headers: { 'X-Workspace': 'products' },
    });
    expect(categoriesOptions).toEqual({
      params: { page: 1, includeArchived: false },
      headers: { 'X-Workspace': 'categories', 'X-View': 'tree' },
    });
  });

  it.each(['POST', 'PUT', 'PATCH'] as const)(
    'forwards the %s body without an implicit retry',
    (method) => {
      let result: unknown;
      const body = { name: 'Đèn bàn' };
      const write =
        method === 'POST'
          ? client.post<{ id: string }>('items', body)
          : method === 'PUT'
            ? client.put<{ id: string }>('items/item-1', body)
            : client.patch<{ id: string }>('items/item-1', body);
      write.subscribe((value) => {
        result = value;
      });
      const request = http.expectOne((value) => value.method === method);
      expect(request.request.body).toEqual(body);
      request.flush({ id: 'item-1' });
      expect(result).toEqual({ id: 'item-1' });
    },
  );

  it('supports HttpParams, header records and explicit credentials for deletes', () => {
    client
      .delete('items/item-1', {
        params: new HttpParams().set('version', 2),
        headers: { 'If-Match': '2' },
        withCredentials: true,
      })
      .subscribe();
    const request = http.expectOne('/api/v1/items/item-1?version=2');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('If-Match')).toBe('2');
    expect(request.request.withCredentials).toBe(true);
    request.flush(null);
  });

  it('passes response errors through the configured normalizer once', () => {
    let error: unknown;
    client.post('items', { name: '' }).subscribe({
      error: (value: unknown) => {
        error = value;
      },
    });
    http.expectOne('/api/v1/items').flush(
      { errors: { Name: ['Bắt buộc nhập.'] } },
      {
        status: 422,
        statusText: 'Unprocessable Content',
      },
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      kind: 'validation',
      fieldErrors: { Name: ['Bắt buộc nhập.'] },
    });
    http.expectNone('/api/v1/items');
  });

  it('inherits cold requests and cancellation from HttpClient', () => {
    const request = client.request<{ id: string }>('GET', 'items/item-1');
    http.expectNone('/api/v1/items/item-1');
    const subscription = request.subscribe();
    const pending = http.expectOne('/api/v1/items/item-1');
    subscription.unsubscribe();
    expect(pending.cancelled).toBe(true);
  });

  it.each(['../items', '/items', 'https://other.test/items', 'items?secret=value', '%2e%2e/items'])(
    'rejects a resource outside the configured base: %s',
    (path) => {
      expect(() => client.get(path)).toThrow('relative path');
      http.expectNone(() => true);
    },
  );

  it('offers a typed request entry for endpoint-specific services', () => {
    const method: ApiMethod = 'PATCH';
    client
      .request<{ updated: boolean }>(method, 'items/item-1', { body: { name: 'Mới' } })
      .subscribe();
    const request = http.expectOne('/api/v1/items/item-1');
    expect(request.request.body).toEqual({ name: 'Mới' });
    request.flush({ updated: true });
  });
});
