/** Backend `PaginationResponse<T>`; `currentPage` is one-based. */
export interface PaginationResponse<T> {
  readonly data: readonly T[];
  readonly currentPage: number;
  readonly totalPages: number;
  readonly totalCount: number;
  readonly pageSize: number;
  readonly hasPreviousPage: boolean;
  readonly hasNextPage: boolean;
}

/** Backend `Page<T>(Items, Total, PageNumber, PageSize)`. */
export interface PageWire<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly pageNumber: number;
  readonly pageSize: number;
}

/** The one page shape screens read, whichever contract the endpoint uses. */
export interface PagedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface PaginationParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly keyword?: string;
  readonly orderBy?: readonly string[];
}

export function pagedResult<T>(
  items: readonly T[],
  total: number,
  page: number,
  pageSize: number,
): PagedResult<T> {
  const size = Math.max(1, pageSize);
  return {
    items,
    total,
    page: Math.max(1, page),
    pageSize: size,
    totalPages: Math.ceil(total / size),
  };
}

export function fromPaginationResponse<T>(raw: PaginationResponse<T>): PagedResult<T> {
  return pagedResult(raw.data, raw.totalCount, raw.currentPage, raw.pageSize);
}

export function fromPage<T>(raw: PageWire<T>): PagedResult<T> {
  return pagedResult(raw.items, raw.total, raw.pageNumber, raw.pageSize);
}
