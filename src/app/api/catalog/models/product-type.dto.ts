export enum ProductFieldType {
  Text = 1,
  Number = 2,
  Boolean = 3,
  Date = 4,
  Choice = 5,
}

export interface ProductFieldChoiceDto {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
}

export interface ProductFieldDefinitionDto {
  readonly id: string;
  readonly code: string;
  readonly dataType: ProductFieldType;
  readonly label: string;
  readonly helpText: string | null;
  readonly isRequired: boolean;
  readonly isFilterable: boolean;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly choices: readonly ProductFieldChoiceDto[];
}

export interface ProductTypeDto {
  readonly id: string;
  readonly version: string;
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly fields: readonly ProductFieldDefinitionDto[];
  readonly createdOn?: string;
  readonly lastModifiedOn?: string | null;
}

interface ChoiceInput {
  readonly code: string;
  readonly label: string;
}

export interface FieldDefinitionInput {
  readonly code: string;
  readonly dataType: ProductFieldType;
  readonly label: string;
  readonly helpText: string | null;
  readonly isRequired: boolean;
  readonly isFilterable: boolean;
  readonly choices: readonly ChoiceInput[];
}

interface FieldChoiceEdit {
  readonly id: string;
  readonly label: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
}

interface FieldDefinitionEdit {
  readonly id: string;
  readonly label: string;
  readonly helpText: string | null;
  readonly isFilterable: boolean;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly addChoices: readonly ChoiceInput[];
  readonly choices: readonly FieldChoiceEdit[];
}

export interface CreateProductTypeRequest {
  readonly code: string;
  readonly name: string;
  readonly fields: readonly FieldDefinitionInput[];
}

export interface EditProductTypeRequest {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly addFields: readonly FieldDefinitionInput[];
  readonly fields: readonly FieldDefinitionEdit[];
}

interface ProductFieldTypeOption {
  readonly value: ProductFieldType;
  readonly label: string;
}

export const PRODUCT_TYPE_LIMITS = {
  code: 100,
  name: 256,
  label: 256,
  help: 1000,
  fields: 100,
  choices: 200,
} as const;

export const PRODUCT_TYPE_PAGE_SIZE = 20;
export const PRODUCT_TYPE_SEARCH_DELAY_MS = 260;
export const PRODUCT_TYPE_CODE_PATTERN = /^[a-zA-Z0-9._-]+$/u;

export const PRODUCT_FIELD_TYPE_OPTIONS: readonly ProductFieldTypeOption[] = [
  { value: ProductFieldType.Text, label: 'Văn bản' },
  { value: ProductFieldType.Number, label: 'Số' },
  { value: ProductFieldType.Boolean, label: 'Đúng / Sai' },
  { value: ProductFieldType.Date, label: 'Ngày' },
  { value: ProductFieldType.Choice, label: 'Lựa chọn' },
];
