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

export enum ProductFieldType {
  Text = 1,
  Number = 2,
  Boolean = 3,
  Date = 4,
  Choice = 5,
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

export interface ProductMedia {
  readonly mediaAssetId: string;
  readonly sortOrder: number;
  readonly altText: string | null;
}

interface ProductVariantSelection {
  readonly optionId: string;
  readonly optionValueId: string;
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
  readonly images?: readonly ProductMedia[];
  readonly weight?: number | null;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly length?: number | null;
  readonly selections: readonly ProductVariantSelection[];
}

interface ProductOptionValue {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly sortOrder: number;
}

export interface ProductOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly values: readonly ProductOptionValue[];
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
  readonly media: readonly ProductMedia[];
  readonly fulfillmentKind: ProductFulfillmentKind;
  readonly createdOn?: string;
  readonly modifiedOn?: string;
}

export interface CatalogQueryChange {
  readonly search: string;
  readonly categoryId: string | null;
  readonly page: number;
  readonly delay: number;
}

export const EMPTY_PRODUCT_PAGE: ProductPage = {
  items: [],
  total: 0,
  pageNumber: 1,
  pageSize: 20,
};

export const CATALOG_SKELETON_ITEMS = [1, 2, 3, 4] as const;

const CATEGORY_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function parseCatalogCategoryId(raw: string | null): string | null {
  return raw && CATEGORY_UUID_PATTERN.test(raw) ? raw : null;
}

export function isDigitalFulfillment(kind: ProductFulfillmentKind): boolean {
  return kind !== ProductFulfillmentKind.Physical;
}

export function getFulfillmentLabel(kind: ProductFulfillmentKind): string {
  switch (kind) {
    case ProductFulfillmentKind.Physical:
      return 'Hàng vật lý';
    case ProductFulfillmentKind.DigitalUnique:
      return 'Bản quyền số riêng';
    case ProductFulfillmentKind.DigitalShared:
      return 'Nội dung số dùng chung';
    case ProductFulfillmentKind.ManualExtension:
      return 'Gia hạn dịch vụ';
    default:
      return 'Sản phẩm';
  }
}

const PRODUCT_IMAGE_RULES: readonly { readonly pattern: RegExp; readonly image: string }[] = [
  { pattern: /\b(lamp|den|lighting|arc)\b/u, image: '/images/lamp.svg' },
  { pattern: /\b(bag|tote|tui)\b/u, image: '/images/bag.svg' },
  { pattern: /\b(notebook|so-tay|book)\b/u, image: '/images/notebook.svg' },
  { pattern: /\b(shoe|runner|giay|sneaker)\b/u, image: '/images/shoe.svg' },
  { pattern: /\b(vase|gom|binh)\b/u, image: '/images/vase.svg' },
  { pattern: /\b(chair|ghe|lounge)\b/u, image: '/images/chair.svg' },
  { pattern: /\b(headphone|tai-nghe)\b/u, image: '/images/headphones.svg' },
  { pattern: /\b(camera|may-anh)\b/u, image: '/images/camera.svg' },
];

export function getStorefrontProductFallbackImage(slug: string, name: string): string | null {
  const searchable = normalizeProductText(`${slug} ${name}`);
  return PRODUCT_IMAGE_RULES.find(({ pattern }) => pattern.test(searchable))?.image ?? null;
}

export function resolveCatalogImageSource(
  mediaId: string | null | undefined,
  slug: string,
  name: string,
): string | null {
  if (mediaId) return `/api/catalog/media/${mediaId}`;
  return getStorefrontProductFallbackImage(slug, name);
}

function normalizeProductText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^a-z0-9-]+/gu, ' ');
}
