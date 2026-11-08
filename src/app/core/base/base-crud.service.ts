import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService, QueryParamMap } from './base-api.service';
import { PagedResult } from './paged.model';

/**
 * Generic CRUD service mirroring Backend BaseApiController conventions:
 * GET {endpoint}, POST {endpoint}/search, GET {endpoint}/{id},
 * POST {endpoint}, PUT {endpoint}/{id}, DELETE {endpoint}/{id}?version=, POST {endpoint}/export.
 */
@Injectable()
export abstract class BaseCrudService<
  TDto,
  TCreate = Partial<TDto>,
  TUpdate = TCreate,
  TFilter extends object = Record<string, unknown>,
  TKey extends string | number = string,
> extends BaseApiService {
  protected abstract readonly endpoint: string;

  getAll(filter?: TFilter): Observable<readonly TDto[]> {
    return this.get<readonly TDto[]>(this.endpoint, filter as QueryParamMap | undefined);
  }

  getPage(filter?: TFilter): Observable<PagedResult<TDto>> {
    return this.getPageFrom<TDto>(this.endpoint, filter as QueryParamMap | undefined);
  }

  search(filter: TFilter): Observable<PagedResult<TDto>> {
    return this.postPageFrom<TDto>(`${this.endpoint}/search`, filter);
  }

  getById(id: TKey): Observable<TDto> {
    return this.get<TDto>(this.itemPath(id));
  }

  create(payload: TCreate): Observable<TDto> {
    return this.post<TDto>(this.endpoint, payload);
  }

  update(id: TKey, payload: TUpdate): Observable<TDto> {
    return this.put<TDto>(this.itemPath(id), payload);
  }

  delete(id: TKey, version?: string): Observable<void> {
    return this.deleteResource<void>(this.itemPath(id), version ? { version } : undefined);
  }

  exportExcel(filter: unknown, fileName: string): Observable<void> {
    return this.downloadBlob('POST', `${this.endpoint}/export`, filter, fileName);
  }

  protected itemPath(id: TKey, suffix = ''): string {
    const encoded = encodeURIComponent(String(id));
    return suffix ? `${this.endpoint}/${encoded}/${suffix}` : `${this.endpoint}/${encoded}`;
  }
}
