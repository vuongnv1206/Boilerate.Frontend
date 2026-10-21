import { FormArray, FormControl, FormGroup, FormRecord } from '@angular/forms';
import { CreateOptionForm, CreateSkuForm } from '@forms/product-commerce.form';
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
  defaultVariantSku: FormControl<string>;
  media: FormArray<ProductMediaForm>;
  options: FormArray<CreateOptionForm>;
  variants: FormArray<CreateSkuForm>;
  fields: FormRecord<FormControl<ProductFieldControlValue>>;
}>;

export type ProductMediaForm = FormGroup<{
  mediaAssetId: FormControl<string>;
  sortOrder: FormControl<number>;
  altText: FormControl<string | null>;
}>;
