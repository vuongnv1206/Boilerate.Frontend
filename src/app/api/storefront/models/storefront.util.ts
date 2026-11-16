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

export function resolveCatalogImageSource(
  mediaId: string | null | undefined,
  _slug?: string,
  _name?: string,
): string | null {
  return mediaId ? `/api/catalog/media/${mediaId}` : null;
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
