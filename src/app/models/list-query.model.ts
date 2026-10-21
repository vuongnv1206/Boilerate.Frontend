export interface ListQuery {
  readonly q: string;
  readonly page: number;
}

export interface ProductListQuery extends ListQuery {
  readonly status: number | null;
  readonly pageSize: number;
}
