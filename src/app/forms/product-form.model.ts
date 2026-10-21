import { FormControl, FormGroup, FormRecord } from '@angular/forms';
import { ProductFulfillmentKind } from '@enums/product.enum';

export type ProductFieldControlValue = string | number | boolean | null;

export type ProductForm = FormGroup<{
  name: FormControl<string>;
  slug: FormControl<string>;
  description: FormControl<string>;
  productTypeId: FormControl<string>;
  categoryIds: FormControl<string[]>;
  fulfillmentKind: FormControl<ProductFulfillmentKind>;
  sku: FormControl<string>;
  price: FormControl<number | null>;
  fields: FormRecord<FormControl<ProductFieldControlValue>>;
}>;
