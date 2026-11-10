import { FormControl, FormGroup, Validators } from '@angular/forms';
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

export interface CategoryParentOption {
  readonly id: string;
  readonly label: string;
}

export interface CategoryProductIssue {
  readonly id: string;
  readonly name: string;
  readonly message: string;
}

export interface PendingCategoryDuplicate {
  readonly id: string;
  readonly changes: readonly { readonly productId: string; readonly version: string }[];
}

export const CATEGORY_LIMITS = {
  name: 256,
  slug: 200,
  description: 4000,
} as const;

export const CATEGORY_PAGE_SIZE = 20;
export const CATEGORY_SEARCH_DELAY_MS = 180;
export const CATEGORY_SLUG_PATTERN = /^[a-zA-Z0-9-]+$/u;

export type CategoryForm = ReturnType<typeof createCategoryForm>;

export function createCategoryForm() {
  return new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/\S/u),
        Validators.maxLength(CATEGORY_LIMITS.name),
      ],
    }),
    slug: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(CATEGORY_SLUG_PATTERN),
        Validators.maxLength(CATEGORY_LIMITS.slug),
      ],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(CATEGORY_LIMITS.description)],
    }),
    parentId: new FormControl('', { nonNullable: true }),
    sortOrder: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/u)],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
  });
}

export function categoryFormValue(record?: CategoryDto): ReturnType<CategoryForm['getRawValue']> {
  return {
    name: record?.name ?? '',
    slug: record?.slug ?? '',
    description: record?.description ?? '',
    parentId: record?.parentId ?? '',
    sortOrder: record?.sortOrder ?? 0,
    isActive: record?.isActive ?? true,
  };
}

export function categoryRequest(
  form: CategoryForm,
  record?: CategoryDto | null,
): SaveCategoryRequest {
  const value = form.getRawValue();
  return {
    id: record?.id ?? null,
    version: record?.version ?? null,
    name: value.name.trim(),
    slug: value.slug.trim(),
    description: value.description.trim() || null,
    parentId: value.parentId || null,
    sortOrder: value.sortOrder,
    isActive: value.isActive,
  };
}
