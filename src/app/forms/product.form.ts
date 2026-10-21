import { slugify } from '@utils/text.util';
import {
  FormArray,
  FormControl,
  FormRecord,
  FormBuilder,
  FormGroup,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  CreateOptionForm,
  CreateSkuForm,
  createOptionForm,
  createSkuRow,
  nullableVndPrice,
} from '@forms/product-commerce.form';
import {
  PRODUCT_LIMITS,
  PRODUCT_FIELD_ALIASES,
  PRODUCT_SKU_PATTERN,
  PRODUCT_SLUG_PATTERN,
} from '@constants/product.constants';
import { ProductFulfillmentKind } from '@enums/product.enum';
import { ProductFieldType } from '@enums/product-field-type.enum';
import { ProductFieldControlValue, ProductForm, ProductMediaForm } from '@forms/product-form.model';
import { ProductFieldDefinition, ProductTypeLookup } from '@models/product-lookups.dto';
import {
  ProductContent,
  ProductDto,
  ProductFieldInput,
  ProductFieldValue,
  ProductMedia,
  SaveProductEditor,
} from '@models/product.dto';

const trimmedRequired: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

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
    price: new FormControl<number | null>(0, nullableVndPrice),
    defaultVariantSku: builder.control(''),
    media: new FormArray<ProductMediaForm>([]),
    options: new FormArray<CreateOptionForm>([]),
    variants: new FormArray<CreateSkuForm>([]),
    fields: new FormRecord<FormControl<ProductFieldControlValue>>({}),
  });
}

export function initializeProductForm(form: ProductForm, item: ProductDto | null): void {
  form.controls.options.clear({ emitEvent: false });
  form.controls.variants.clear({ emitEvent: false });
  form.controls.media.clear({ emitEvent: false });
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
      defaultVariantSku: item?.variants.find((variant) => variant.isDefault)?.sku ?? '',
    },
    { emitEvent: false },
  );
  for (const media of item?.media ?? [])
    form.controls.media.push(createProductMediaForm(media), { emitEvent: false });
  for (const option of item?.options ?? [])
    form.controls.options.push(createOptionForm(option), { emitEvent: false });
  for (const variant of item?.variants ?? []) {
    const selection: Record<string, string> = {};
    for (const selected of variant.selections) {
      const option = item?.options.find((value) => value.id === selected.optionId);
      const value = option?.values.find((value) => value.id === selected.optionValueId);
      if (option && value) selection[option.code] = value.code;
    }
    const row = createSkuRow(variant.sku, selection, variant.price);
    row.patchValue(
      {
        id: variant.id,
        compareAtPrice: variant.compareAtPrice,
        isActive: variant.isActive,
        imageMediaId: variant.imageMediaId,
      },
      { emitEvent: false },
    );
    form.controls.variants.push(row, { emitEvent: false });
  }
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
    media: value.media.map((media, index) => ({
      mediaAssetId: media.mediaAssetId,
      sortOrder: index,
      altText: media.altText?.trim() || null,
    })),
  };
}

export function createProductMediaForm(media: ProductMedia): ProductMediaForm {
  return new FormGroup({
    mediaAssetId: new FormControl(media.mediaAssetId, {
      nonNullable: true,
      validators: Validators.required,
    }),
    sortOrder: new FormControl(media.sortOrder, { nonNullable: true }),
    altText: new FormControl<string | null>(media.altText, Validators.maxLength(500)),
  });
}

export function productEditorRequest(
  form: ProductForm,
  schema: ProductTypeLookup,
  item: ProductDto,
  allowPrice = true,
): SaveProductEditor {
  const raw = form.getRawValue();
  return {
    id: item.id,
    version: item.version,
    productTypeVersion: schema.version,
    content: toProductContent(form, schema, item),
    optionEdits: raw.options
      .filter((option) => !!option.id)
      .map((option) => ({
        optionId: option.id,
        name: option.name.trim(),
        sortOrder: option.sortOrder,
        addValues: option.values
          .filter((value) => !value.id)
          .map((value) => ({ code: value.code.trim().toUpperCase(), label: value.label.trim() })),
        values: option.values
          .filter((value) => !!value.id)
          .map((value) => ({
            id: value.id,
            label: value.label.trim(),
            sortOrder: value.sortOrder,
          })),
      })),
    variantEdits: raw.variants
      .filter((variant) => !!variant.id)
      .map((variant) => {
        const canonical = item.variants.find((value) => value.id === variant.id);
        return {
          variantId: variant.id,
          price: allowPrice ? variant.price : (canonical?.price ?? null),
          compareAtPrice: allowPrice ? variant.compareAtPrice : (canonical?.compareAtPrice ?? null),
          isActive: variant.isActive,
          imageMediaId: variant.imageMediaId,
        };
      }),
    addedVariants: raw.variants
      .filter((variant) => !variant.id)
      .map((variant) => ({
        sku: variant.sku.trim(),
        options: variant.options,
        price: allowPrice ? variant.price : null,
        compareAtPrice: allowPrice ? variant.compareAtPrice : null,
        isActive: variant.isActive,
        imageMediaId: variant.imageMediaId,
      })),
    defaultVariantSku:
      raw.defaultVariantSku || item.variants.find((variant) => variant.isDefault)?.sku || '',
  };
}

/** Validation indexes refer to the submitted deltas, rather than the full grid. */
export function productEditorAliases(
  request: SaveProductEditor,
  form: ProductForm,
): Readonly<Record<string, string>> {
  const aliases: Record<string, string> = { ...productFieldAliases(request.content.fields) };
  const rows = form.controls.variants.controls;
  const addAliases = (prefix: string, index: number, target: string, fields: readonly string[]) => {
    for (const field of fields)
      for (const name of [prefix, prefix[0]?.toLowerCase() + prefix.slice(1)]) {
        const lower = field[0]?.toLowerCase() + field.slice(1);
        aliases[`${name}[${index}].${field}`] = `${target}.${lower}`;
        aliases[`${name}[${index}].${lower}`] = `${target}.${lower}`;
      }
  };
  request.variantEdits.forEach((variant, index) =>
    addAliases(
      'VariantEdits',
      index,
      `variants.${rows.findIndex((row) => row.controls.id.value === variant.variantId)}`,
      ['Price', 'CompareAtPrice', 'IsActive', 'ImageMediaId'],
    ),
  );
  request.addedVariants.forEach((variant, index) =>
    addAliases(
      'AddedVariants',
      index,
      `variants.${rows.findIndex((row) => !row.controls.id.value && row.controls.sku.value.trim() === variant.sku)}`,
      ['Sku', 'Price', 'CompareAtPrice', 'IsActive', 'ImageMediaId'],
    ),
  );
  request.optionEdits.forEach((option, index) => {
    const optionIndex = form.controls.options.controls.findIndex(
      (row) => row.controls.id.value === option.optionId,
    );
    addAliases('OptionEdits', index, `options.${optionIndex}`, ['Name', 'SortOrder']);
  });
  return aliases;
}

export function productSlug(name: string): string {
  return slugify(name).slice(0, PRODUCT_LIMITS.slug);
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

/** Use the submitted order, never the current schema index, to map a server field path. */
export function productFieldAliases(
  fields: readonly ProductFieldInput[],
): Readonly<Record<string, string>> {
  const aliases: Record<string, string> = { ...PRODUCT_FIELD_ALIASES };
  fields.forEach((field, index) => {
    for (const prefix of ['Content.Fields', 'content.fields', 'Fields', 'fields']) {
      const target = `fields.${field.fieldDefinitionId}`;
      aliases[`${prefix}[${index}]`] = target;
      for (const name of [
        'TextValue',
        'NumberValue',
        'BooleanValue',
        'DateValue',
        'ChoiceId',
        'FieldDefinitionId',
        'textValue',
        'numberValue',
        'booleanValue',
        'dateValue',
        'choiceId',
        'fieldDefinitionId',
      ]) {
        aliases[`${prefix}[${index}].${name}`] = target;
        aliases[`${prefix}.${index}.${name}`] = target;
      }
    }
  });
  return aliases;
}
