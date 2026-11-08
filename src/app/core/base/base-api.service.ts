import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { ApiClient, ApiRequestOptions } from '../http/api-client';
import { AnyPagedWire, PagedResult, normalizePagedResult } from './paged.model';

type QueryPrimitive = string | number | boolean;
export type QueryParamMap = Readonly<Record<string, unknown>>;

/**
 * Base HTTP service providing clean query-param sanitization, paged normalization,
 * text endpoints, and one-line Excel/Blob file downloads.
 */
@Injectable()
export abstract class BaseApiService {
  protected readonly api = inject(ApiClient);
  private readonly document = inject(DOCUMENT);

  protected get<T>(
    resource: string,
    params?: QueryParamMap,
    options?: ApiRequestOptions,
  ): Observable<T> {
    return this.api.get<T>(resource, this.withParams(params, options));
  }

  protected getPageFrom<T>(
    resource: string,
    params?: QueryParamMap,
    options?: ApiRequestOptions,
  ): Observable<PagedResult<T>> {
    return this.get<AnyPagedWire<T>>(resource, params, options).pipe(
      map((raw) => normalizePagedResult(raw)),
    );
  }

  protected postPageFrom<T>(
    resource: string,
    body: unknown,
    options?: ApiRequestOptions,
  ): Observable<PagedResult<T>> {
    return this.api
      .post<AnyPagedWire<T>>(resource, body, options)
      .pipe(map((raw) => normalizePagedResult(raw)));
  }

  protected post<T>(
    resource: string,
    body: unknown = null,
    options?: ApiRequestOptions,
  ): Observable<T> {
    return this.api.post<T>(resource, body, options);
  }

  protected put<T>(resource: string, body: unknown, options?: ApiRequestOptions): Observable<T> {
    return this.api.put<T>(resource, body, options);
  }

  protected patch<T>(resource: string, body: unknown, options?: ApiRequestOptions): Observable<T> {
    return this.api.patch<T>(resource, body, options);
  }

  protected deleteResource<T = void>(
    resource: string,
    params?: QueryParamMap,
    options?: ApiRequestOptions,
  ): Observable<T> {
    return this.api.delete<T>(resource, this.withParams(params, options));
  }

  protected getText(
    resource: string,
    params?: QueryParamMap,
    options?: ApiRequestOptions,
  ): Observable<string> {
    return this.api.text('GET', resource, undefined, this.withParams(params, options));
  }

  protected postText(
    resource: string,
    body: unknown,
    options?: ApiRequestOptions,
  ): Observable<string> {
    return this.api.text('POST', resource, body, options);
  }

  protected downloadBlob(
    method: 'GET' | 'POST',
    resource: string,
    payloadOrParams: unknown,
    fileName: string,
    options?: ApiRequestOptions,
  ): Observable<void> {
    const request$ =
      method === 'POST'
        ? this.api.postBlob(resource, payloadOrParams, options)
        : this.api.blob(
            resource,
            this.withParams(payloadOrParams as QueryParamMap | undefined, options),
          );
    return request$.pipe(
      tap((blob) => this.saveBlobToDisk(blob, fileName)),
      map(() => undefined),
    );
  }

  protected cleanParams(
    params?: QueryParamMap,
  ): Record<string, QueryPrimitive | readonly QueryPrimitive[]> | undefined {
    if (!params) return undefined;
    const cleaned: Record<string, QueryPrimitive | readonly QueryPrimitive[]> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        const items = value.filter(
          (item): item is QueryPrimitive =>
            typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean',
        );
        if (items.length > 0) cleaned[key] = items;
      } else if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        cleaned[key] = value;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }

  private withParams(params?: QueryParamMap, options?: ApiRequestOptions): ApiRequestOptions {
    const cleaned = this.cleanParams(params);
    if (!cleaned) return options ?? {};
    return { ...options, params: cleaned };
  }

  private saveBlobToDisk(blob: Blob, fileName: string): void {
    const win = this.document.defaultView;
    if (!win?.URL?.createObjectURL) return;
    const url = win.URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    this.document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => win.URL.revokeObjectURL(url), 100);
  }
}
