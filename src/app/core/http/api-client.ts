import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RuntimeConfig } from '../config/runtime-config';
import { RUNTIME_CONFIG } from '../config/runtime-config.token';
import { apiUrl } from './api-url';

export interface ApiRequestOptions {
  readonly headers?: HttpHeaders | Record<string, string | string[]>;
  readonly params?:
    HttpParams | Record<string, string | number | boolean | readonly (string | number | boolean)[]>;
  readonly context?: HttpContext;
  readonly withCredentials?: boolean;
}

type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Typed HTTP transport. Domain services inherit BaseApiService / BaseCrudService on top of this. */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  constructor(
    private readonly http: HttpClient,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
  ) {}

  get<T>(resource: string, options?: ApiRequestOptions): Observable<T> {
    return this.request<T>('GET', resource, options);
  }

  post<T>(resource: string, body: unknown, options?: ApiRequestOptions): Observable<T> {
    return this.request<T>('POST', resource, { ...options, body });
  }

  put<T>(resource: string, body: unknown, options?: ApiRequestOptions): Observable<T> {
    return this.request<T>('PUT', resource, { ...options, body });
  }

  patch<T>(resource: string, body: unknown, options?: ApiRequestOptions): Observable<T> {
    return this.request<T>('PATCH', resource, { ...options, body });
  }

  delete<T = void>(resource: string, options?: ApiRequestOptions): Observable<T> {
    return this.request<T>('DELETE', resource, options);
  }

  text(
    method: ApiMethod,
    resource: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ): Observable<string> {
    return this.http.request(method, apiUrl(this.config.apiBaseUrl, resource), {
      ...options,
      body,
      observe: 'body',
      responseType: 'text',
    });
  }

  blob(resource: string, options?: ApiRequestOptions): Observable<Blob> {
    return this.http.get(apiUrl(this.config.apiBaseUrl, resource), {
      ...options,
      observe: 'body',
      responseType: 'blob',
    });
  }

  postBlob(resource: string, body: unknown, options?: ApiRequestOptions): Observable<Blob> {
    return this.http.post(apiUrl(this.config.apiBaseUrl, resource), body, {
      ...options,
      observe: 'body',
      responseType: 'blob',
    });
  }

  request<T>(
    method: ApiMethod,
    resource: string,
    options: ApiRequestOptions & { readonly body?: unknown } = {},
  ): Observable<T> {
    return this.http.request<T>(method, apiUrl(this.config.apiBaseUrl, resource), {
      ...options,
      observe: 'body',
      responseType: 'json',
    });
  }
}
