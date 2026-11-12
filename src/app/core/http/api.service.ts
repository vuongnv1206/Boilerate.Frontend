import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { RuntimeConfig } from '../config/runtime-config';
import { RUNTIME_CONFIG } from '../config/runtime-config.token';
import { apiUrl } from './api-url';

/** Query string values. Empty ones (`undefined`, `null`, `''`) are left out of the URL. */
export type QueryParams = Readonly<Record<string, unknown>>;

export interface ApiRequestOptions {
  readonly headers?: HttpHeaders | Record<string, string | string[]>;
  readonly params?: QueryParams;
  readonly context?: HttpContext;
  readonly withCredentials?: boolean;
}

type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type QueryValue = string | number | boolean;

/** The only door to the Backend. Domain services in `api/<domain>/services` call it directly. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(
    private readonly http: HttpClient,
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {}

  get<T>(resource: string, params?: QueryParams, options?: ApiRequestOptions): Observable<T> {
    return this.json<T>('GET', resource, undefined, { ...options, params });
  }

  post<T>(resource: string, body: unknown = null, options?: ApiRequestOptions): Observable<T> {
    return this.json<T>('POST', resource, body, options);
  }

  put<T>(resource: string, body: unknown, options?: ApiRequestOptions): Observable<T> {
    return this.json<T>('PUT', resource, body, options);
  }

  patch<T>(resource: string, body: unknown, options?: ApiRequestOptions): Observable<T> {
    return this.json<T>('PATCH', resource, body, options);
  }

  delete<T = void>(
    resource: string,
    params?: QueryParams,
    options?: ApiRequestOptions,
  ): Observable<T> {
    return this.json<T>('DELETE', resource, undefined, { ...options, params });
  }

  /** For endpoints that answer with plain text (an id, a message) instead of JSON. */
  text(
    method: ApiMethod,
    resource: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ): Observable<string> {
    return this.http.request(method, this.url(resource), {
      ...this.requestOptions(options),
      body,
      observe: 'body',
      responseType: 'text',
    });
  }

  blob(resource: string, params?: QueryParams): Observable<Blob> {
    return this.http.get(this.url(resource), {
      ...this.requestOptions({ params }),
      observe: 'body',
      responseType: 'blob',
    });
  }

  /** Requests a file and hands it to the browser as a download. */
  download(
    method: 'GET' | 'POST',
    resource: string,
    payload: unknown,
    fileName: string,
  ): Observable<void> {
    const file$ =
      method === 'POST'
        ? this.http.post(this.url(resource), payload, { observe: 'body', responseType: 'blob' })
        : this.blob(resource, payload as QueryParams | undefined);
    return file$.pipe(map((file) => this.saveFile(file, fileName)));
  }

  private json<T>(
    method: ApiMethod,
    resource: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ): Observable<T> {
    return this.http.request<T>(method, this.url(resource), {
      ...this.requestOptions(options),
      body,
      observe: 'body',
      responseType: 'json',
    });
  }

  private url(resource: string): string {
    return apiUrl(this.config.apiBaseUrl, resource);
  }

  private requestOptions(options: ApiRequestOptions = {}) {
    const params: Record<string, QueryValue | readonly QueryValue[]> = {};
    for (const [key, value] of Object.entries(options.params ?? {})) {
      if (Array.isArray(value)) {
        const items = value.filter(isQueryValue);
        if (items.length > 0) params[key] = items;
      } else if (isQueryValue(value) && value !== '') {
        params[key] = value;
      }
    }
    return { ...options, params };
  }

  private saveFile(file: Blob, fileName: string): void {
    const view = this.document.defaultView;
    if (!view?.URL?.createObjectURL) return;
    const url = view.URL.createObjectURL(file);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    this.document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => view.URL.revokeObjectURL(url), 100);
  }
}

function isQueryValue(value: unknown): value is QueryValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}
