import { HttpParams } from '@angular/common/http';

/** Matches the BE PaginationResponse JSON contract; currentPage is one-based. */
export interface PaginationResponse<T> {
  readonly data: readonly T[];
  readonly currentPage: number;
  readonly totalPages: number;
  readonly totalCount: number;
  readonly pageSize: number;
  readonly hasPreviousPage: boolean;
  readonly hasNextPage: boolean;
}

export interface PaginationRequest {
  readonly pageNumber: number;
  readonly pageSize: number;
}

/** UI paginator index conversion belongs to the owning feature. */
export function paginationParams(request: PaginationRequest): HttpParams {
  if (!Number.isSafeInteger(request.pageNumber) || request.pageNumber < 1) {
    throw new Error('Pagination pageNumber must be a positive one-based integer.');
  }
  if (!Number.isSafeInteger(request.pageSize) || request.pageSize < 1) {
    throw new Error('Pagination pageSize must be a positive integer.');
  }
  return new HttpParams().set('pageNumber', request.pageNumber).set('pageSize', request.pageSize);
}
