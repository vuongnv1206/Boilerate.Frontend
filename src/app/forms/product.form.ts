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
  optionInputs,
} from '@forms/product-commerce.form';
import {
  PRODUCT_LIMITS,
  PRODUCT_FIELD_ALIASES,
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
  CatalogConfiguration,
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
    sku: ['', Validators.maxLength(PRODUCT_LIMITS.sku)],
    price: new FormControl<number | null>(0, nullableVndPrice),
    defaultVariantSku: builder.control(''),
    defaultVariantId: builder.control(''),
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
      defaultVariantId: item?.variants.find((variant) => variant.isDefault)?.id ?? '',
    },
    { emitEvent: false },
  );
  for (const media of item?.media ?? [])
    form.controls.media.push(createProductMediaForm(media), { emitEvent: false });
  for (const option of item?.options ?? [])
    form.controls.options.push(createOptionForm(option), { emitEvent: false });
  const assignedMediaIds = new Set(
    item?.variants.flatMap((variant) => [
      variant.imageMediaId,
      ...(variant.images ?? []).map((image) => image.mediaAssetId),
    ]) ?? [],
  );
  const legacyGallery =
    item?.media.filter((media) => !assignedMediaIds.has(media.mediaAssetId)) ?? [];
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
        clientId: variant.id,
        trackInventory: variant.trackInventory ?? true,
        quantity: variant.quantity ?? null,
        inventoryVersion: variant.inventoryVersion ?? null,
        images: variant.images?.length
          ? variant.images
          : variant.isDefault
            ? legacyGallery.slice(variant.imageMediaId ? 0 : 1)
            : [],
        weight: variant.weight ?? null,
        width: variant.width ?? null,
        height: variant.height ?? null,
        length: variant.length ?? null,
        compareAtPrice: variant.compareAtPrice,
        isActive: variant.isActive,
        imageMediaId:
          variant.imageMediaId ??
          (variant.isDefault ? (legacyGallery[0]?.mediaAssetId ?? null) : null),
      },
      { emitEvent: false },
    );
    form.controls.variants.push(row, { emitEvent: false });
  }
  if (!item) {
    const row = createSkuRow('', {}, 0);
    form.controls.variants.push(row, { emitEvent: false });
    form.controls.defaultVariantId.setValue(row.controls.clientId.value, { emitEvent: false });
  }
  setProductIdentityReadonly(form, !!item);
}

/** Existing products retain their product type and fulfillment policy. Variant SKU is editable. */
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
  const referencedMedia = new Set(
    value.variants.flatMap((variant) => [
      variant.imageMediaId,
      ...variant.images.map((image) => image.mediaAssetId),
    ]),
  );
  return {
    name: value.name.trim(),
    slug: value.slug.trim().toLowerCase(),
    description: value.description.trim() || null,
    categoryIds: value.categoryIds,
    fields,
    media: value.media
      .filter((media) => referencedMedia.has(media.mediaAssetId))
      .map((media, index) => ({
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
    configuration: productConfiguration(form, allowPrice, item),
    version: item.version,
    productTypeVersion: schema.version,
    content: toProductContent(form, schema, item),
    addedOptions: optionInputs(
      form.controls.options.controls.filter((option) => !option.controls.id.value),
    ),
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

export function productConfiguration(
  form: ProductForm,
  allowPrice = true,
  original: ProductDto | null = null,
): CatalogConfiguration {
  const options = form.controls.options.controls;
  const optionKey = (option: (typeof options)[number]) =>
    option.controls.id.value || option.controls.clientId.value;
  const variants = form.controls.variants.controls;
  return {
    options: options.map((option) => ({
      id: optionKey(option),
      name: option.controls.name.value.trim(),
      values: option.controls.values.controls.map((value) => ({
        id: value.controls.id.value || value.controls.clientId.value,
        label: value.controls.label.value.trim(),
      })),
    })),
    variants: variants.map((row) => {
      const raw = row.getRawValue();
      const canonical = original?.variants.find((variant) => variant.id === raw.id);
      const selections: Record<string, string> = {};
      for (const option of options) {
        const value = option.controls.values.controls.find(
          (value) => value.controls.code.value === raw.options[option.controls.code.value],
        );
        if (value)
          selections[optionKey(option)] = value.controls.id.value || value.controls.clientId.value;
      }
      return {
        ...raw,
        id: raw.id || raw.clientId,
        sku: raw.sku.trim(),
        price: allowPrice ? raw.price : (canonical?.price ?? null),
        compareAtPrice: allowPrice ? raw.compareAtPrice : (canonical?.compareAtPrice ?? null),
        selections,
      };
    }),
    defaultVariantId:
      form.controls.defaultVariantId.value || variants[0]?.controls.clientId.value || '',
  };
}

interface CatalogIdentitySnapshot {
  readonly options: readonly {
    readonly id: string;
    readonly position: number;
    readonly name: string;
    readonly values: readonly {
      readonly id: string;
      readonly position: number;
      readonly label: string;
    }[];
  }[];
  readonly variants: readonly {
    readonly id: string;
    readonly selectionCodes: Readonly<Record<string, string>>;
    readonly selections: Readonly<Record<string, string>>;
  }[];
}

/** Keep local draft IDs aligned with server IDs when newer input was made during a save. */
export function captureCatalogIdentity(form: ProductForm): CatalogIdentitySnapshot {
  return {
    options: form.controls.options.controls.map((option, position) => ({
      id: option.controls.id.value || option.controls.clientId.value,
      position,
      name: option.controls.name.value.trim(),
      values: option.controls.values.controls.map((value, valuePosition) => ({
        id: value.controls.id.value || value.controls.clientId.value,
        position: valuePosition,
        label: value.controls.label.value.trim(),
      })),
    })),
    variants: form.controls.variants.controls.map((variant) => {
      const selections: Record<string, string> = {};
      for (const option of form.controls.options.controls) {
        const value = option.controls.values.controls.find(
          (candidate) =>
            candidate.controls.code.value ===
            variant.controls.options.value[option.controls.code.value],
        );
        if (value)
          selections[option.controls.id.value || option.controls.clientId.value] =
            value.controls.id.value || value.controls.clientId.value;
      }
      return {
        id: variant.controls.id.value || variant.controls.clientId.value,
        selectionCodes: { ...variant.controls.options.value },
        selections,
      };
    }),
  };
}

export function reconcileCatalogIdentity(
  form: ProductForm,
  saved: ProductDto,
  snapshot: CatalogIdentitySnapshot,
): void {
  for (const submitted of snapshot.options) {
    const savedOption = saved.options.find((option) => option.sortOrder === submitted.position);
    const currentOption = form.controls.options.controls.find(
      (option) => (option.controls.id.value || option.controls.clientId.value) === submitted.id,
    );
    if (!savedOption || !currentOption) continue;
    currentOption.patchValue(
      { id: savedOption.id, clientId: savedOption.id, sortOrder: savedOption.sortOrder },
      { emitEvent: false },
    );
    for (const submittedValue of submitted.values) {
      const savedValue = savedOption.values.find(
        (value) => value.sortOrder === submittedValue.position,
      );
      const currentValue = currentOption.controls.values.controls.find(
        (value) => (value.controls.id.value || value.controls.clientId.value) === submittedValue.id,
      );
      if (savedValue && currentValue)
        currentValue.patchValue(
          { id: savedValue.id, clientId: savedValue.id, sortOrder: savedValue.sortOrder },
          { emitEvent: false },
        );
    }
  }

  const signature = (selections: readonly (readonly [string, string])[]) =>
    JSON.stringify([...selections].sort(([left], [right]) => left.localeCompare(right)));
  const submittedVariants = new Map(snapshot.variants.map((variant) => [variant.id, variant]));
  const variantsBySignature = new Map<string, ProductDto['variants'][number]>();
  for (const variant of saved.variants) {
    const selections: [string, string][] = [];
    for (const selection of variant.selections) {
      const option = saved.options.find((candidate) => candidate.id === selection.optionId);
      const value = option?.values.find((candidate) => candidate.id === selection.optionValueId);
      if (option && value) selections.push([option.name, value.label]);
    }
    variantsBySignature.set(signature(selections), variant);
  }

  const variantIds = new Map<string, string>();
  for (const row of form.controls.variants.controls) {
    const rowId = row.controls.id.value || row.controls.clientId.value;
    const submitted = submittedVariants.get(rowId);
    if (
      !submitted ||
      JSON.stringify(
        Object.entries(row.controls.options.value).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ) !==
        JSON.stringify(
          Object.entries(submitted.selectionCodes).sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        )
    )
      continue;
    const submittedSelectionLabels: [string, string][] = [];
    for (const [optionId, valueId] of Object.entries(submitted.selections)) {
      const option = snapshot.options.find((candidate) => candidate.id === optionId);
      const value = option?.values.find((candidate) => candidate.id === valueId);
      if (option && value) submittedSelectionLabels.push([option.name, value.label]);
    }
    const savedVariant = variantsBySignature.get(signature(submittedSelectionLabels));
    if (!savedVariant) continue;
    variantIds.set(rowId, savedVariant.id);
    row.patchValue(
      {
        id: savedVariant.id,
        clientId: savedVariant.id,
        inventoryVersion: savedVariant.inventoryVersion ?? null,
        inventoryOperationId: crypto.randomUUID(),
      },
      { emitEvent: false },
    );
  }

  const savedDefault = variantIds.get(form.controls.defaultVariantId.value);
  if (savedDefault) form.controls.defaultVariantId.setValue(savedDefault, { emitEvent: false });
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
