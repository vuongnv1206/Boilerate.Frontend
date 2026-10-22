/** Contract returned by CategoriesController; Version is an opaque concurrency token. */
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
