import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RUNTIME_CONFIG } from '../config/runtime-config.token';
import { apiUrl } from './api-url';

export interface ApiRequestOptions {
  readonly headers?: HttpHeaders | Record<string, string | string[]>;
  readonly params?:
    HttpParams | Record<string, string | number | boolean | readonly (string | number | boolean)[]>;
  readonly context?: HttpContext;
  readonly withCredentials?: boolean;
}

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Typed JSON transport. Feature services own endpoint paths and response mapping. */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

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

  text(method: ApiMethod, resource: string, body: unknown): Observable<string> {
    return this.http.request(method, apiUrl(this.config.apiBaseUrl, resource), {
      body,
      responseType: 'text',
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
