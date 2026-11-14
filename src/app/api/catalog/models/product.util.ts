import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormRecord,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { createOperationId } from '@core/http/operation-id';
import {
  ListQuery,
  PRODUCT_LIMITS,
  ProductFieldControlValue,
  ProductFulfillmentKind,
  ProductListQuery,
  ProductMediaDto,
  ProductOption,
} from './product.dto';

const PRODUCT_SLUG_PATTERN = /^[a-z0-9-]+$/u;

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[đĐ]/gu, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

export function productSlug(name: string): string {
  return slugify(name).slice(0, PRODUCT_LIMITS.slug);
}

type QueryValues = Readonly<Record<string, unknown>>;

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function readListQuery(values: QueryValues): ListQuery {
  return {
    q: typeof values['q'] === 'string' ? values['q'].trim() : '',
    page: positiveInteger(values['page'], 1),
  };
}

export function readProductListQuery(values: QueryValues): ProductListQuery {
  const status = positiveInteger(values['status'], 0);
  const pageSize = positiveInteger(values['pageSize'], 10);
  const fulfillment = positiveInteger(values['fulfillmentKind'], 0);
  const ids = ['categoryId', 'productTypeId'] as const;
  const price = (value: unknown): number | undefined => {
    if (typeof value !== 'string' || !/^\d+$/u.test(value)) return undefined;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
  };
  const minimumPrice = price(values['minimumPrice']);
  const maximumPrice = price(values['maximumPrice']);
  const sortBy = values['sortBy'];
  const sortDirection = values['sortDirection'];
  return {
    ...readListQuery(values),
    status: [1, 2, 3].includes(status) ? status : null,
    pageSize: [10, 20, 50].includes(pageSize) ? pageSize : 10,
    ...Object.fromEntries(
      ids.flatMap((key) => {
        const value = values[key];
        return typeof value === 'string' &&
          /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu.test(value)
          ? [[key, value.toLowerCase()]]
          : [];
      }),
    ),
    ...([1, 2, 3, 4].includes(fulfillment) ? { fulfillmentKind: fulfillment } : {}),
    ...(values['inStock'] === 'true' || values['inStock'] === 'false'
      ? { inStock: values['inStock'] === 'true' }
      : {}),
    ...(minimumPrice !== undefined ? { minimumPrice } : {}),
    ...(maximumPrice !== undefined ? { maximumPrice } : {}),
    ...(sortBy === 'name' || sortBy === 'price' ? { sortBy } : {}),
    ...(sortDirection === 'asc' ? { sortDirection } : {}),
  };
}

export function listQueryParams(
  query: ListQuery | ProductListQuery,
): Record<string, string | number> {
  return {
    ...(query.q ? { q: query.q } : {}),
    ...(query.page > 1 ? { page: query.page } : {}),
    ...('status' in query && query.status !== null ? { status: query.status } : {}),
    ...('pageSize' in query && query.pageSize !== 10 ? { pageSize: query.pageSize } : {}),
    ...('pageSize' in query
      ? Object.fromEntries(
          (
            [
              'categoryId',
              'productTypeId',
              'fulfillmentKind',
              'inStock',
              'minimumPrice',
              'maximumPrice',
              'sortBy',
              'sortDirection',
            ] as const
          ).flatMap((key) => (query[key] === undefined ? [] : [[key, String(query[key])]])),
        )
      : {}),
  };
}

const catalogRequired: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

const nullableVndPrice: ValidatorFn = (control) =>
  control.value === null ||
  (typeof control.value === 'number' && Number.isSafeInteger(control.value) && control.value >= 0)
    ? null
    : { vndPrice: true };

export const comparePrice: ValidatorFn = (group) => {
  const price: unknown = group.get('price')?.value;
  const comparison: unknown = group.get('compareAtPrice')?.value;
  return comparison === null ||
    (typeof comparison === 'number' && typeof price === 'number' && comparison > price)
    ? null
    : { comparePrice: true };
};

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

export function createOptionValueForm(code = '', label = '', id = '', sortOrder = 0) {
  return new FormGroup({
    id: new FormControl(id, { nonNullable: true }),
    clientId: new FormControl(id || createOperationId(), { nonNullable: true }),
    sortOrder: new FormControl(sortOrder, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.pattern(/^\d+$/u)],
    }),
    code: new FormControl(code || `VALUE_${createOperationId().replaceAll('-', '')}`, {
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
    clientId: new FormControl(option?.id || createOperationId(), { nonNullable: true }),
    sortOrder: new FormControl(option?.sortOrder ?? 0, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.pattern(/^\d+$/u)],
    }),
    code: new FormControl(option?.code || `OPTION_${createOperationId().replaceAll('-', '')}`, {
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
export function createSkuRow(
  sku: string,
  options: Readonly<Record<string, string>>,
  price: number | null = null,
) {
  return new FormGroup(
    {
      id: new FormControl('', { nonNullable: true }),
      clientId: new FormControl<string>(createOperationId(), { nonNullable: true }),
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
      inventoryOperationId: new FormControl<string>(createOperationId(), { nonNullable: true }),
      images: new FormControl<readonly ProductMediaDto[]>([], { nonNullable: true }),
      weight: new FormControl<number | null>(null, Validators.min(0)),
      width: new FormControl<number | null>(null, Validators.min(0)),
      height: new FormControl<number | null>(null, Validators.min(0)),
      length: new FormControl<number | null>(null, Validators.min(0)),
    },
    { validators: comparePrice },
  );
}

export type CreateSkuForm = ReturnType<typeof createSkuRow>;
export type VariantRowSnapshot = ReturnType<CreateSkuForm['getRawValue']>;

export function createProductMediaForm(media: ProductMediaDto) {
  return new FormGroup({
    mediaAssetId: new FormControl(media.mediaAssetId, {
      nonNullable: true,
      validators: Validators.required,
    }),
    sortOrder: new FormControl(media.sortOrder, { nonNullable: true }),
    altText: new FormControl<string | null>(media.altText, Validators.maxLength(500)),
  });
}

type ProductMediaForm = ReturnType<typeof createProductMediaForm>;

export function createProductForm() {
  const builder = new FormBuilder().nonNullable;
  return builder.group({
    name: ['', [catalogRequired, Validators.maxLength(PRODUCT_LIMITS.name)]],
    slug: [
      '',
      [
        catalogRequired,
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

export type ProductForm = ReturnType<typeof createProductForm>;
