import { FormControl, FormRecord, FormBuilder, ValidatorFn, Validators } from '@angular/forms';
import {
  PRODUCT_LIMITS,
  PRODUCT_SKU_PATTERN,
  PRODUCT_SLUG_PATTERN,
} from '@constants/product.constants';
import { ProductFulfillmentKind } from '@enums/product.enum';
import { ProductFieldType } from '@enums/product-field-type.enum';
import { ProductFieldControlValue, ProductForm } from '@models/product-form.model';
import { ProductFieldDefinition, ProductTypeLookup } from '@models/product-lookups.model';
import {
  ProductContent,
  ProductDto,
  ProductFieldInput,
  ProductFieldValue,
} from '@models/product.model';

const trimmedRequired: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

const vndPrice: ValidatorFn = (control) =>
  typeof control.value === 'number' && Number.isSafeInteger(control.value) && control.value >= 0
    ? null
    : { vndPrice: true };

export function createProductForm(): ProductForm {
  const builder = new FormBuilder().nonNullable;
  return builder.group({
    name: ['', [trimmedRequired, Validators.maxLength(PRODUCT_LIMITS.name)]],
    slug: [
      '',
      [
        trimmedRequired,
        Validators.maxLength(PRODUCT_LIMITS.slug),
        Validators.pattern(PRODUCT_SLUG_PATTERN),
      ],
    ],
    description: ['', Validators.maxLength(PRODUCT_LIMITS.description)],
    productTypeId: ['', Validators.required],
    categoryIds: builder.control<string[]>([]),
    fulfillmentKind: builder.control(ProductFulfillmentKind.Physical),
    sku: [
      '',
      [
        trimmedRequired,
        Validators.maxLength(PRODUCT_LIMITS.sku),
        Validators.pattern(PRODUCT_SKU_PATTERN),
      ],
    ],
    price: new FormControl<number | null>(0, [Validators.required, vndPrice]),
    fields: new FormRecord<FormControl<ProductFieldControlValue>>({}),
  });
}

export function initializeProductForm(form: ProductForm, item: ProductDto | null): void {
  form.reset(
    {
      name: item?.name ?? '',
      slug: item?.slug ?? '',
      description: item?.description ?? '',
      productTypeId: item?.productTypeId ?? '',
      categoryIds: [...(item?.categoryIds ?? [])],
      fulfillmentKind: item?.fulfillmentKind ?? ProductFulfillmentKind.Physical,
      sku: item?.variants.find((variant) => variant.isDefault)?.sku ?? '',
      price: item?.variants.find((variant) => variant.isDefault)?.price ?? 0,
    },
    { emitEvent: false },
  );
  setProductIdentityReadonly(form, !!item);
}

/** Catalog content edits cannot change SKU identity, fulfillment kind or product type. */
export function setProductIdentityReadonly(form: ProductForm, readonly: boolean): void {
  for (const control of [
    form.controls.productTypeId,
    form.controls.fulfillmentKind,
    form.controls.sku,
    form.controls.price,
  ]) {
    if (readonly) control.disable({ emitEvent: false });
    else control.enable({ emitEvent: false });
  }
}

export function configureProductFields(
  form: ProductForm,
  schema: ProductTypeLookup,
  values: readonly ProductFieldValue[] = [],
): void {
  const controls = form.controls.fields;
  for (const key of Object.keys(controls.controls))
    controls.removeControl(key, { emitEvent: false });
  for (const definition of schema.fields) {
    const existing = values.find((value) => value.fieldDefinitionId === definition.id);
    if (!definition.isActive && !existing) continue;
    const value = fieldControlValue(definition, existing);
    const validators: ValidatorFn[] = [];
    if (definition.isRequired && definition.isActive) {
      validators.push((control) =>
        control.value === null ||
        control.value === '' ||
        (typeof control.value === 'string' && !control.value.trim())
          ? { required: true }
          : null,
      );
    }
    if (definition.dataType === ProductFieldType.Text) validators.push(Validators.maxLength(500));
    if (definition.dataType === ProductFieldType.Number) validators.push(fieldNumber);
    const control = new FormControl<ProductFieldControlValue>(value, validators);
    if (!definition.isActive) control.disable({ emitEvent: false });
    controls.addControl(definition.id, control, { emitEvent: false });
  }
}

export function toProductContent(
  form: ProductForm,
  schema: ProductTypeLookup,
  original: ProductDto | null,
): ProductContent {
  const value = form.getRawValue();
  const fields: ProductFieldInput[] = [];
  for (const definition of schema.fields) {
    const control = form.controls.fields.controls[definition.id];
    if (!control) continue;
    const raw = control.value;
    if (!definition.isActive) {
      const previous = original?.fields.find((field) => field.fieldDefinitionId === definition.id);
      if (previous) fields.push(fieldInput(previous));
    } else if (raw !== null && raw !== '' && !(typeof raw === 'string' && !raw.trim())) {
      fields.push({
        fieldDefinitionId: definition.id,
        fieldType: definition.dataType,
        ...typedFieldValue(definition.dataType, raw),
      });
    }
  }
  return {
    name: value.name.trim(),
    slug: value.slug.trim().toLowerCase(),
    description: value.description.trim() || null,
    categoryIds: value.categoryIds,
    fields,
    media: original?.media ?? [],
  };
}

export function productSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[đĐ]/gu, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, PRODUCT_LIMITS.slug);
}

function fieldControlValue(
  definition: ProductFieldDefinition,
  existing?: ProductFieldValue,
): ProductFieldControlValue {
  if (existing)
    return (
      existing.textValue ??
      existing.numberValue ??
      existing.booleanValue ??
      existing.dateValue ??
      existing.choiceId ??
      null
    );
  return definition.dataType === ProductFieldType.Boolean ? false : null;
}

function typedFieldValue(
  type: ProductFieldType,
  value: Exclude<ProductFieldControlValue, null>,
): Partial<ProductFieldInput> {
  switch (type) {
    case ProductFieldType.Text:
      return { textValue: String(value).trim() };
    case ProductFieldType.Number:
      return { numberValue: Number(value) };
    case ProductFieldType.Boolean:
      return { booleanValue: Boolean(value) };
    case ProductFieldType.Date:
      return { dateValue: String(value) };
    case ProductFieldType.Choice:
      return { choiceId: String(value) };
  }
}

function fieldInput(value: ProductFieldValue): ProductFieldInput {
  return {
    fieldDefinitionId: value.fieldDefinitionId,
    fieldType: value.fieldType,
    textValue: value.textValue,
    numberValue: value.numberValue,
    booleanValue: value.booleanValue,
    dateValue: value.dateValue,
    choiceId: value.choiceId,
  };
}

const fieldNumber: ValidatorFn = (control) => {
  if (control.value === null || control.value === '') return null;
  const value: unknown = control.value;
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) < 100000000000000 &&
    Math.abs(Math.round(value * 10000) / 10000 - value) < 1e-8
    ? null
    : { fieldNumber: true };
};
