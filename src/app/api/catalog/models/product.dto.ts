import { CategoryDto } from './category.dto';
import {
  ProductFieldChoiceDto,
  ProductFieldDefinitionDto,
  ProductFieldType,
  ProductTypeDto,
} from './product-type.dto';

export enum ProductStatus {
  Draft = 1,
  Published = 2,
  Archived = 3,
}

export enum ProductFulfillmentKind {
  Physical = 1,
  DigitalUnique = 2,
  DigitalShared = 3,
  ManualExtension = 4,
}

export interface ProductSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: ProductStatus;
  readonly fromPrice: number | null;
  readonly inStock: boolean;
  readonly fulfillmentKind: ProductFulfillmentKind;
  readonly productTypeId?: string;
  readonly productTypeName?: string;
  readonly thumbnailMediaId?: string | null;
  readonly version?: string;
  readonly modifiedOn?: string;
}

export interface ProductPage {
  readonly items: readonly ProductSummary[];
  readonly total: number;
  readonly pageNumber: number;
  readonly pageSize: number;
}

export interface ProductSearch {
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly status?: ProductStatus;
  readonly categoryId?: string;
  readonly productTypeId?: string;
  readonly fulfillmentKind?: ProductFulfillmentKind;
  readonly inStock?: boolean;
  readonly minimumPrice?: number;
  readonly maximumPrice?: number;
  readonly sortBy?: 'modified' | 'name' | 'price';
  readonly sortDirection?: 'asc' | 'desc';
}

export interface ProductMediaDto {
  readonly mediaAssetId: string;
  readonly sortOrder: number;
  readonly altText: string | null;
}

export interface ProductVariant {
  readonly id: string;
  readonly sku: string;
  readonly combinationKey: string;
  readonly price: number | null;
  readonly compareAtPrice: number | null;
  readonly currency: string;
  readonly isDefault: boolean;
  readonly isActive: boolean;
  readonly imageMediaId: string | null;
  readonly inStock: boolean;
  readonly trackInventory?: boolean;
  readonly quantity?: number | null;
  readonly inventoryVersion?: string | null;
  readonly images?: readonly ProductMediaDto[];
  readonly weight?: number | null;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly length?: number | null;
  readonly selections: readonly { readonly optionId: string; readonly optionValueId: string }[];
}

export interface ProductOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly values: readonly {
    readonly id: string;
    readonly code: string;
    readonly label: string;
    readonly sortOrder: number;
  }[];
}

export interface ProductFieldInput {
  readonly fieldDefinitionId: string;
  readonly fieldType: ProductFieldType;
  readonly textValue?: string | null;
  readonly numberValue?: number | null;
  readonly booleanValue?: boolean | null;
  readonly dateValue?: string | null;
  readonly choiceId?: string | null;
}

export interface ProductFieldValue extends ProductFieldInput {
  readonly label: string;
  readonly choiceLabel: string | null;
}

export interface ProductDto {
  readonly id: string;
  readonly productTypeId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: ProductStatus;
  readonly version: string;
  readonly categoryIds: readonly string[];
  readonly options: readonly ProductOption[];
  readonly variants: readonly ProductVariant[];
  readonly fields: readonly ProductFieldValue[];
  readonly media: readonly ProductMediaDto[];
  readonly fulfillmentKind: ProductFulfillmentKind;
  readonly createdOn?: string;
  readonly modifiedOn?: string;
}

export interface ProductContent {
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly categoryIds: readonly string[];
  readonly fields: readonly ProductFieldInput[];
  readonly media: readonly ProductMediaDto[];
}

export interface ProductOptionInput {
  readonly code: string;
  readonly name: string;
  readonly values: readonly { readonly code: string; readonly label: string }[];
}

export interface ProductVariantInput {
  readonly sku: string;
  readonly price: number | null;
  readonly compareAtPrice: number | null;
  readonly options: Readonly<Record<string, string>>;
  readonly isActive?: boolean;
  readonly imageMediaId?: string | null;
}

export interface CatalogConfiguration {
  readonly options: readonly {
    readonly id: string;
    readonly name: string;
    readonly values: readonly { readonly id: string; readonly label: string }[];
  }[];
  readonly variants: readonly {
    readonly id: string;
    readonly sku: string;
    readonly price: number | null;
    readonly compareAtPrice: number | null;
    readonly selections: Readonly<Record<string, string>>;
    readonly isActive: boolean;
    readonly imageMediaId: string | null;
    readonly trackInventory: boolean;
    readonly quantity: number | null;
    readonly inventoryVersion: string | null;
    readonly inventoryOperationId: string;
    readonly images: readonly ProductMediaDto[];
    readonly weight: number | null;
    readonly width: number | null;
    readonly height: number | null;
    readonly length: number | null;
  }[];
  readonly defaultVariantId: string;
}

export interface CreateProduct {
  readonly productTypeId: string;
  readonly productTypeVersion: string;
  readonly content: ProductContent;
  readonly options: readonly ProductOptionInput[];
  readonly variants: readonly ProductVariantInput[];
  readonly fulfillmentKind: ProductFulfillmentKind;
  readonly defaultVariantSku?: string | null;
  readonly configuration?: CatalogConfiguration;
}

export interface EditProduct {
  readonly id: string;
  readonly version: string;
  readonly productTypeVersion: string;
  readonly content: ProductContent;
}

export interface SaveProductEditor extends EditProduct {
  readonly configuration?: CatalogConfiguration;
  readonly addedOptions: readonly ProductOptionInput[];
  readonly optionEdits: readonly {
    readonly optionId: string;
    readonly name: string;
    readonly sortOrder: number;
    readonly addValues: readonly { readonly code: string; readonly label: string }[];
    readonly values: readonly {
      readonly id: string;
      readonly label: string;
      readonly sortOrder: number;
    }[];
  }[];
  readonly variantEdits: readonly {
    readonly variantId: string;
    readonly price: number | null;
    readonly compareAtPrice: number | null;
    readonly isActive: boolean;
    readonly imageMediaId: string | null;
  }[];
  readonly addedVariants: readonly ProductVariantInput[];
  readonly defaultVariantSku: string;
}

export interface BulkProductStatus {
  readonly items: readonly { readonly id: string; readonly version: string }[];
  readonly status: ProductStatus;
}

export interface BulkProductStatusResult {
  readonly items: readonly {
    readonly id: string;
    readonly status: ProductStatus;
    readonly version: string;
  }[];
}

export interface AddProductVariant {
  readonly productId: string;
  readonly version: string;
  readonly variant: ProductVariantInput;
}

export interface EditProductVariant {
  readonly productId: string;
  readonly variantId: string;
  readonly version: string;
  readonly price: number | null;
  readonly compareAtPrice: number | null;
  readonly isActive: boolean;
  readonly imageMediaId: string | null;
}

export interface EditProductOption {
  readonly productId: string;
  readonly optionId: string;
  readonly version: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly addValues: readonly { readonly code: string; readonly label: string }[];
  readonly values: readonly {
    readonly id: string;
    readonly label: string;
    readonly sortOrder: number;
  }[];
}

export interface ChangeProductStatus {
  readonly id: string;
  readonly version: string;
  readonly status: ProductStatus;
}

export type ProductCategoryLookup = Pick<CategoryDto, 'id' | 'name' | 'isActive'>;
type ProductFieldChoice = Pick<ProductFieldChoiceDto, 'id' | 'label' | 'isActive'>;
export type ProductFieldDefinition = Pick<
  ProductFieldDefinitionDto,
  'id' | 'code' | 'label' | 'helpText' | 'dataType' | 'isRequired' | 'isActive' | 'sortOrder'
> & {
  readonly choices: readonly ProductFieldChoice[];
};
export type ProductTypeLookup = Pick<
  ProductTypeDto,
  'id' | 'code' | 'name' | 'isActive' | 'version'
> & {
  readonly fields: readonly ProductFieldDefinition[];
};

interface ProductSelectOption<T = string | null> {
  readonly label: string;
  readonly value: T;
}

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
  readonly sortBy?: 'name' | 'price';
  readonly sortDirection?: 'asc';
}

export const PRODUCT_LIMITS = {
  name: 256,
  slug: 200,
  description: 20000,
  sku: 100,
} as const;
export const PRODUCT_PAGE_SIZES: number[] = [10, 20, 50];
export const PRODUCT_SEARCH_DELAY_MS = 250;
export const PRODUCT_OPTION_LIMIT = 3;
export const PRODUCT_VARIANT_LIMIT = 50;

export const PRODUCT_STATUS_LABELS: Readonly<Record<ProductStatus, string>> = {
  [ProductStatus.Draft]: 'Bản nháp',
  [ProductStatus.Published]: 'Đã xuất bản',
  [ProductStatus.Archived]: 'Đã lưu trữ',
};

export const PRODUCT_STATUS_OPTIONS: ProductSelectOption<ProductStatus | null>[] = [
  { label: 'Tất cả trạng thái', value: null },
  { label: PRODUCT_STATUS_LABELS[ProductStatus.Draft], value: ProductStatus.Draft },
  { label: PRODUCT_STATUS_LABELS[ProductStatus.Published], value: ProductStatus.Published },
  { label: PRODUCT_STATUS_LABELS[ProductStatus.Archived], value: ProductStatus.Archived },
];

export const PRODUCT_FULFILLMENT_OPTIONS: ProductSelectOption<ProductFulfillmentKind>[] = [
  { label: 'Hàng vật lý', value: ProductFulfillmentKind.Physical },
  { label: 'Nội dung số riêng', value: ProductFulfillmentKind.DigitalUnique },
  { label: 'Nội dung số dùng chung', value: ProductFulfillmentKind.DigitalShared },
  { label: 'Gia hạn thủ công', value: ProductFulfillmentKind.ManualExtension },
];

export const PRODUCT_LIST_FULFILLMENT_OPTIONS: ProductSelectOption<ProductFulfillmentKind | null>[] =
  [{ label: 'Tất cả cách giao', value: null }, ...PRODUCT_FULFILLMENT_OPTIONS];

export const PRODUCT_STOCK_FILTER_OPTIONS: ProductSelectOption<boolean | null>[] = [
  { label: 'Tất cả khả dụng', value: null },
  { label: 'Có sẵn', value: true },
  { label: 'Chưa khả dụng', value: false },
];

export const PRODUCT_SORT_OPTIONS: ProductSelectOption<string>[] = [
  { label: 'Cập nhật mới nhất', value: 'modified:desc' },
  { label: 'Cập nhật cũ nhất', value: 'modified:asc' },
  { label: 'Tên A → Z', value: 'name:asc' },
  { label: 'Tên Z → A', value: 'name:desc' },
  { label: 'Giá tăng dần', value: 'price:asc' },
  { label: 'Giá giảm dần', value: 'price:desc' },
];

export const PRODUCT_FIELD_ALIASES = {
  'Content.Name': 'name',
  'Content.Slug': 'slug',
  'Content.Description': 'description',
  'Content.CategoryIds': 'categoryIds',
  'content.name': 'name',
  'content.slug': 'slug',
  'content.description': 'description',
  'content.categoryIds': 'categoryIds',
  'Variants[0].Sku': 'sku',
  'Variants[0].Price': 'price',
  'variants[0].sku': 'sku',
  'variants[0].price': 'price',
} as const;

export type ProductFieldControlValue = string | number | boolean | null;
