import { CategoryDto } from '@models/category.dto';
import {
  ProductFieldChoiceDto,
  ProductFieldDefinitionDto,
  ProductTypeDto,
} from '@models/product-type.dto';

/** Product editor read projections of the same Catalog wire contracts, not duplicated DTO shapes. */
export type ProductCategoryLookup = Pick<CategoryDto, 'id' | 'name' | 'isActive'>;
export type ProductFieldChoice = Pick<ProductFieldChoiceDto, 'id' | 'label' | 'isActive'>;
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
