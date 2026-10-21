import { ProductFulfillmentKind, ProductStatus } from '@enums/product.enum';
import { ProductFieldType } from '@enums/product-field-type.enum';

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

export interface ProductMedia {
  readonly mediaAssetId: string;
  readonly sortOrder: number;
  readonly altText: string | null;
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
  readonly media: readonly ProductMedia[];
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
  readonly media: readonly ProductMedia[];
}

export interface CreateProduct {
  readonly productTypeId: string;
  readonly productTypeVersion: string;
  readonly content: ProductContent;
  readonly options: readonly ProductOptionInput[];
  readonly variants: readonly ProductVariantInput[];
  readonly fulfillmentKind: ProductFulfillmentKind;
  readonly defaultVariantSku?: string | null;
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

export interface SaveProductEditor extends EditProduct {
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

export interface EditProduct {
  readonly id: string;
  readonly version: string;
  readonly productTypeVersion: string;
  readonly content: ProductContent;
}

export interface ChangeProductStatus {
  readonly id: string;
  readonly version: string;
  readonly status: ProductStatus;
}
