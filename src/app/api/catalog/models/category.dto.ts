import { ProductSummary } from './product.dto';

export interface CategoryProductIssueItem {
  readonly product: ProductSummary;
  readonly included: boolean;
  readonly message: string;
}

export interface CategoryDto {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly parentId: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
  readonly createdOn?: string;
  readonly lastModifiedOn?: string | null;
}

export interface SaveCategoryRequest {
  readonly id: string | null;
  readonly version: string | null;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly parentId: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
}

export interface CategoryProductCount {
  readonly id: string;
  readonly productCount: number;
}

export interface CategoryProductChange {
  readonly productId: string;
  readonly version: string;
  readonly included: boolean;
}

export interface CategoryProductResult {
  readonly productId: string;
  readonly version: string;
  readonly included: boolean;
}

export const CATEGORY_LIMITS = {
  name: 256,
  slug: 200,
  description: 4000,
} as const;

export const CATEGORY_PAGE_SIZE = 20;
export const CATEGORY_SEARCH_DELAY_MS = 180;
export const CATEGORY_SLUG_PATTERN = /^[a-zA-Z0-9-]+$/u;
