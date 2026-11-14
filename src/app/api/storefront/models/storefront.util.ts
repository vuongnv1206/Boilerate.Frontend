import { ProductFieldType, ProductFieldValue, ProductFulfillmentKind } from './storefront.dto';

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

/** A product attribute as shoppers read it; empty when the attribute has no value. */
export function productFieldText(field: ProductFieldValue): string {
  switch (field.fieldType) {
    case ProductFieldType.Number:
      return field.numberValue === null || field.numberValue === undefined
        ? ''
        : field.numberValue.toLocaleString('vi-VN');
    case ProductFieldType.Boolean:
      return field.booleanValue === null || field.booleanValue === undefined
        ? ''
        : field.booleanValue
          ? 'Có'
          : 'Không';
    case ProductFieldType.Date:
      return field.dateValue ? field.dateValue.slice(0, 10).split('-').reverse().join('/') : '';
    case ProductFieldType.Choice:
      return field.choiceLabel ?? '';
    default:
      return field.textValue?.trim() ?? '';
  }
}
