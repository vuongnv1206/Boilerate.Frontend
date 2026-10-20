import { ProductFieldType } from '@enums/product-field-type.enum';

export const PRODUCT_TYPE_LIMITS = {
  code: 100,
  name: 256,
  label: 256,
  help: 1000,
  fields: 100,
  choices: 200,
} as const;
export const PRODUCT_TYPE_PAGE_SIZE = 20;
export const PRODUCT_TYPE_CODE_PATTERN = /^[a-zA-Z0-9._-]+$/u;
export const PRODUCT_FIELD_TYPE_OPTIONS = [
  { value: ProductFieldType.Text, label: 'Văn bản' },
  { value: ProductFieldType.Number, label: 'Số' },
  { value: ProductFieldType.Boolean, label: 'Đúng / Sai' },
  { value: ProductFieldType.Date, label: 'Ngày' },
  { value: ProductFieldType.Choice, label: 'Lựa chọn' },
] as const;
