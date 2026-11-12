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
