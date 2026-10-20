import { ProductFulfillmentKind, ProductStatus } from '@enums/product.enum';

export const PRODUCT_LIMITS = { name: 256, slug: 200, description: 20000, sku: 100 } as const;
export const PRODUCT_SLUG_PATTERN = /^[a-z0-9-]+$/u;
export const PRODUCT_SKU_PATTERN = /^[A-Za-z0-9._-]+$/u;
export const PRODUCT_PAGE_SIZES = [10, 20, 50] as const;
export const PRODUCT_SEARCH_DELAY_MS = 250;
export const PRODUCT_STATUS_LABELS: Readonly<Record<ProductStatus, string>> = {
  [ProductStatus.Draft]: 'Bản nháp',
  [ProductStatus.Published]: 'Đã xuất bản',
  [ProductStatus.Archived]: 'Đã lưu trữ',
};
export const PRODUCT_STATUS_OPTIONS = [
  { label: 'Tất cả trạng thái', value: null },
  ...Object.values(ProductStatus)
    .filter((value): value is ProductStatus => typeof value === 'number')
    .map((value) => ({ label: PRODUCT_STATUS_LABELS[value], value })),
];
export const PRODUCT_FULFILLMENT_OPTIONS = [
  { label: 'Hàng vật lý', value: ProductFulfillmentKind.Physical },
  { label: 'Nội dung số riêng', value: ProductFulfillmentKind.DigitalUnique },
  { label: 'Nội dung số dùng chung', value: ProductFulfillmentKind.DigitalShared },
  { label: 'Gia hạn thủ công', value: ProductFulfillmentKind.ManualExtension },
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
