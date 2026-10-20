import type { FormControl, FormGroup } from '@angular/forms';

export type ContentForm = FormGroup<{
  name: FormControl<string>;
  slug: FormControl<string>;
  description: FormControl<string>;
  category: FormControl<string>;
  price: FormControl<number>;
  sku: FormControl<string>;
  stock: FormControl<number>;
  featured: FormControl<boolean>;
  seoTitle: FormControl<string>;
  seoDescription: FormControl<string>;
}>;

export type ContentFormValue = ReturnType<ContentForm['getRawValue']>;
