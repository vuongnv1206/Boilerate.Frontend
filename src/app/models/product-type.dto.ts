import { ProductFieldType } from '@enums/product-field-type.enum';

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
export interface ChoiceInput {
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
export interface FieldChoiceEdit {
  readonly id: string;
  readonly label: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
}
export interface FieldDefinitionEdit {
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
