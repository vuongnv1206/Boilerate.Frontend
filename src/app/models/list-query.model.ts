export interface ListQuery {
  readonly q: string;
  readonly page: number;
}

export interface ProductListQuery extends ListQuery {
  readonly status: number | null;
  readonly pageSize: number;
  readonly categoryId?: string;
  readonly productTypeId?: string;
  readonly fulfillmentKind?: number;
  readonly inStock?: boolean;
  readonly minimumPrice?: number;
  readonly maximumPrice?: number;
  readonly sortBy?: 'modified' | 'name' | 'price';
  readonly sortDirection?: 'asc' | 'desc';
}
