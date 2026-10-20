import { ProductFieldType } from '@enums/product-field-type.enum';

/** Fields used when choosing a category or product type in the product form. */
export interface ProductCategoryLookup {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
}

export interface ProductTypeLookup {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly version: string;
  readonly fields: readonly ProductFieldDefinition[];
}

export interface ProductFieldDefinition {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly helpText: string | null;
  readonly dataType: ProductFieldType;
  readonly isRequired: boolean;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly choices: readonly ProductFieldChoice[];
}

export interface ProductFieldChoice {
  readonly id: string;
  readonly label: string;
  readonly isActive: boolean;
}
