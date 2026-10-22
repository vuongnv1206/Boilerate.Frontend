import {
  FormArray,
  FormControl,
  FormGroup,
  FormRecord,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { PRODUCT_SKU_PATTERN } from '@constants/product.constants';
import {
  ProductMedia,
  ProductOption,
  ProductOptionInput,
  ProductVariantInput,
} from '@models/product.dto';
import { slugify } from '@utils/text.util';

export const PRODUCT_OPTION_LIMIT = 3;
export const PRODUCT_VARIANT_LIMIT = 50;

export const catalogRequired: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };
export const nullableVndPrice: ValidatorFn = (control) =>
  control.value === null ||
  (typeof control.value === 'number' && Number.isSafeInteger(control.value) && control.value >= 0)
    ? null
    : { vndPrice: true };
export const catalogCode = [
  catalogRequired,
  Validators.maxLength(100),
  Validators.pattern(PRODUCT_SKU_PATTERN),
];

/** Build a readable stable code for a newly entered option/value label. */
export function generatedCatalogCode(
  label: string,
  siblingCodes: readonly string[],
  fallback: 'OPTION' | 'VALUE',
): string {
  const base = (slugify(label).replaceAll('-', '_').toUpperCase() || fallback).slice(0, 90);
  const existing = new Set(siblingCodes.map((code) => code.toUpperCase()));
  let candidate = base;
  let suffix = 2;
  while (existing.has(candidate)) {
    const tail = `_${suffix++}`;
    candidate = `${base.slice(0, 100 - tail.length)}${tail}`;
  }
  return candidate;
}
export const comparePrice: ValidatorFn = (group) => {
  const price: unknown = group.get('price')?.value;
  const comparison: unknown = group.get('compareAtPrice')?.value;
  return comparison === null ||
    (typeof comparison === 'number' && typeof price === 'number' && comparison > price)
    ? null
    : { comparePrice: true };
};

export function createOptionValueForm(code = '', label = '', id = '', sortOrder = 0) {
  return new FormGroup({
    id: new FormControl(id, { nonNullable: true }),
    clientId: new FormControl(id || crypto.randomUUID(), { nonNullable: true }),
    sortOrder: new FormControl(sortOrder, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.pattern(/^\d+$/u)],
    }),
    code: new FormControl(code || 'VALUE_' + crypto.randomUUID().replaceAll('-', ''), {
      nonNullable: true,
    }),
    label: new FormControl(label, {
      nonNullable: true,
      validators: [catalogRequired, Validators.maxLength(100)],
    }),
  });
}
export function createOptionForm(option?: ProductOption) {
  return new FormGroup({
    id: new FormControl(option?.id ?? '', { nonNullable: true }),
    clientId: new FormControl(option?.id || crypto.randomUUID(), { nonNullable: true }),
    sortOrder: new FormControl(option?.sortOrder ?? 0, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.pattern(/^\d+$/u)],
    }),
    code: new FormControl(option?.code || 'OPTION_' + crypto.randomUUID().replaceAll('-', ''), {
      nonNullable: true,
    }),
    name: new FormControl(option?.name ?? '', {
      nonNullable: true,
      validators: [catalogRequired, Validators.maxLength(100)],
    }),
    values: new FormArray(
      option
        ? option.values.map((value) =>
            createOptionValueForm(value.code, value.label, value.id, value.sortOrder),
          )
        : [],
      { validators: Validators.minLength(1) },
    ),
  });
}
export type CreateOptionForm = ReturnType<typeof createOptionForm>;
export type CreateOptionValueForm = ReturnType<typeof createOptionValueForm>;

export function createSkuRow(
  sku: string,
  options: Readonly<Record<string, string>>,
  price: number | null = null,
) {
  return new FormGroup(
    {
      id: new FormControl('', { nonNullable: true }),
      clientId: new FormControl<string>(crypto.randomUUID(), { nonNullable: true }),
      sku: new FormControl(sku, { nonNullable: true, validators: Validators.maxLength(100) }),
      price: new FormControl<number | null>(price, nullableVndPrice),
      compareAtPrice: new FormControl<number | null>(null, nullableVndPrice),
      options: new FormControl(options, { nonNullable: true }),
      isActive: new FormControl(true, { nonNullable: true }),
      imageMediaId: new FormControl<string | null>(null),
      trackInventory: new FormControl(true, { nonNullable: true }),
      quantity: new FormControl<number | null>(0, [
        Validators.min(0),
        Validators.pattern(/^\d+$/u),
      ]),
      inventoryVersion: new FormControl<string | null>(null),
      inventoryOperationId: new FormControl<string>(crypto.randomUUID(), { nonNullable: true }),
      images: new FormControl<readonly ProductMedia[]>([], { nonNullable: true }),
      weight: new FormControl<number | null>(null, Validators.min(0)),
      width: new FormControl<number | null>(null, Validators.min(0)),
      height: new FormControl<number | null>(null, Validators.min(0)),
      length: new FormControl<number | null>(null, Validators.min(0)),
    },
    { validators: comparePrice },
  );
}
export type CreateSkuForm = ReturnType<typeof createSkuRow>;

export function optionInputs(forms: readonly CreateOptionForm[]): ProductOptionInput[] {
  return forms.map((form) => {
    const raw = form.getRawValue();
    return {
      code: raw.code.trim().toUpperCase(),
      name: raw.name.trim(),
      values: raw.values.map((value) => ({
        code: value.code.trim().toUpperCase(),
        label: value.label.trim(),
      })),
    };
  });
}
export function skuInputs(forms: readonly CreateSkuForm[]): ProductVariantInput[] {
  return forms.map((form) => {
    const raw = form.getRawValue();
    return {
      sku: raw.sku.trim(),
      price: raw.price,
      compareAtPrice: raw.compareAtPrice,
      options: raw.options,
      isActive: raw.isActive,
      imageMediaId: raw.imageMediaId,
    };
  });
}

/** Codes form immutable identities; preserve row drafts when regenerating unchanged combinations. */
export function generateSkuRows(
  options: readonly ProductOptionInput[],
  prefix: string,
  price: number | null,
  previous: readonly CreateSkuForm[],
): CreateSkuForm[] {
  let combinations: Record<string, string>[] = [{}];
  const codes = options.map((option) => option.code.toUpperCase());
  if (options.length > PRODUCT_OPTION_LIMIT || new Set(codes).size !== codes.length)
    throw new Error(`Dùng tối đa ${PRODUCT_OPTION_LIMIT} lựa chọn có mã khác nhau.`);
  for (const option of options) {
    if (
      !option.values.length ||
      new Set(option.values.map((value) => value.code.toUpperCase())).size !== option.values.length
    )
      throw new Error('Giá trị lựa chọn phải có mã khác nhau.');
    if (combinations.length * option.values.length > PRODUCT_VARIANT_LIMIT)
      throw new Error(`Tối đa ${PRODUCT_VARIANT_LIMIT} tổ hợp SKU cho một sản phẩm.`);
    combinations = combinations.flatMap((combination) =>
      option.values.map((value) => ({ ...combination, [option.code]: value.code })),
    );
  }
  const key = (selection: Readonly<Record<string, string>>) =>
    JSON.stringify(Object.entries(selection).sort(([a], [b]) => a.localeCompare(b)));
  return combinations.map(
    (combination) =>
      previous.find((row) => key(row.controls.options.value) === key(combination)) ??
      createSkuRow(
        [prefix.trim(), ...Object.values(combination)].filter(Boolean).join('-'),
        combination,
        price,
      ),
  );
}

export function createVariantForm() {
  return new FormGroup(
    {
      sku: new FormControl('', { nonNullable: true, validators: Validators.maxLength(100) }),
      price: new FormControl<number | null>(null, nullableVndPrice),
      compareAtPrice: new FormControl<number | null>(null, nullableVndPrice),
      isActive: new FormControl(true, { nonNullable: true }),
      imageMediaId: new FormControl<string | null>(null),
      trackInventory: new FormControl(true, { nonNullable: true }),
      quantity: new FormControl<number | null>(0, [
        Validators.min(0),
        Validators.pattern(/^\d+$/u),
      ]),
      inventoryVersion: new FormControl<string | null>(null),
      inventoryOperationId: new FormControl<string>(crypto.randomUUID(), { nonNullable: true }),
      images: new FormControl<readonly ProductMedia[]>([], { nonNullable: true }),
      weight: new FormControl<number | null>(null, Validators.min(0)),
      width: new FormControl<number | null>(null, Validators.min(0)),
      height: new FormControl<number | null>(null, Validators.min(0)),
      length: new FormControl<number | null>(null, Validators.min(0)),
      selections: new FormRecord<FormControl<string>>({}),
    },
    { validators: comparePrice },
  );
}
export function createInventoryAdjustmentForm() {
  return new FormGroup({
    delta: new FormControl<number | null>(null, [
      Validators.required,
      (control) =>
        typeof control.value === 'number' &&
        Number.isInteger(control.value) &&
        control.value !== 0 &&
        Math.abs(control.value) <= 2147483647
          ? null
          : { delta: true },
    ]),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [catalogRequired, Validators.maxLength(1000)],
    }),
  });
}
export function createDigitalContentForm() {
  return new FormGroup({
    reference: new FormControl('', { nonNullable: true, validators: catalogCode }),
    content: new FormControl('', {
      nonNullable: true,
      validators: [
        catalogRequired,
        (control) =>
          typeof control.value === 'string' &&
          new TextEncoder().encode(control.value).length <= 8000
            ? null
            : { contentSize: true },
      ],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
  });
}

export function createOptionEditForm() {
  return new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [catalogRequired, Validators.maxLength(100)],
    }),
    sortOrder: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.pattern(/^\d+$/u)],
    }),
    values: new FormArray<
      FormGroup<{
        id: FormControl<string>;
        label: FormControl<string>;
        sortOrder: FormControl<number>;
      }>
    >([]),
    addValues: new FormArray<ReturnType<typeof createOptionValueForm>>([]),
  });
}
