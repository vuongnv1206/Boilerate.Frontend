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
import { CategoryDto } from './category.dto';
import {
  ProductFieldChoiceDto,
  ProductFieldDefinitionDto,
  ProductFieldType,
  ProductTypeDto,
} from './product-type.dto';

export enum ProductStatus {
  Draft = 1,
  Published = 2,
  Archived = 3,
}

export enum ProductFulfillmentKind {
  Physical = 1,
  DigitalUnique = 2,
  DigitalShared = 3,
  ManualExtension = 4,
}

export interface ProductSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: ProductStatus;
  readonly fromPrice: number | null;
  readonly inStock: boolean;
  readonly fulfillmentKind: ProductFulfillmentKind;
  readonly productTypeId?: string;
  readonly productTypeName?: string;
  readonly thumbnailMediaId?: string | null;
  readonly version?: string;
  readonly modifiedOn?: string;
}

export interface ProductPage {
  readonly items: readonly ProductSummary[];
  readonly total: number;
  readonly pageNumber: number;
  readonly pageSize: number;
}

export interface ProductSearch {
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly status?: ProductStatus;
  readonly categoryId?: string;
  readonly productTypeId?: string;
  readonly fulfillmentKind?: ProductFulfillmentKind;
  readonly inStock?: boolean;
  readonly minimumPrice?: number;
  readonly maximumPrice?: number;
  readonly sortBy?: 'modified' | 'name' | 'price';
  readonly sortDirection?: 'asc' | 'desc';
}

export interface ProductMediaDto {
  readonly mediaAssetId: string;
  readonly sortOrder: number;
  readonly altText: string | null;
}

export interface ProductVariant {
  readonly id: string;
  readonly sku: string;
  readonly combinationKey: string;
  readonly price: number | null;
  readonly compareAtPrice: number | null;
  readonly currency: string;
  readonly isDefault: boolean;
  readonly isActive: boolean;
  readonly imageMediaId: string | null;
  readonly inStock: boolean;
  readonly trackInventory?: boolean;
  readonly quantity?: number | null;
  readonly inventoryVersion?: string | null;
  readonly images?: readonly ProductMediaDto[];
  readonly weight?: number | null;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly length?: number | null;
  readonly selections: readonly { readonly optionId: string; readonly optionValueId: string }[];
}

export interface ProductOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly values: readonly {
    readonly id: string;
    readonly code: string;
    readonly label: string;
    readonly sortOrder: number;
  }[];
}

export interface ProductFieldInput {
  readonly fieldDefinitionId: string;
  readonly fieldType: ProductFieldType;
  readonly textValue?: string | null;
  readonly numberValue?: number | null;
  readonly booleanValue?: boolean | null;
  readonly dateValue?: string | null;
  readonly choiceId?: string | null;
}

export interface ProductFieldValue extends ProductFieldInput {
  readonly label: string;
  readonly choiceLabel: string | null;
}

export interface ProductDto {
  readonly id: string;
  readonly productTypeId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: ProductStatus;
  readonly version: string;
  readonly categoryIds: readonly string[];
  readonly options: readonly ProductOption[];
  readonly variants: readonly ProductVariant[];
  readonly fields: readonly ProductFieldValue[];
  readonly media: readonly ProductMediaDto[];
  readonly fulfillmentKind: ProductFulfillmentKind;
  readonly createdOn?: string;
  readonly modifiedOn?: string;
}

export interface ProductContent {
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly categoryIds: readonly string[];
  readonly fields: readonly ProductFieldInput[];
  readonly media: readonly ProductMediaDto[];
}

export interface ProductOptionInput {
  readonly code: string;
  readonly name: string;
  readonly values: readonly { readonly code: string; readonly label: string }[];
}

export interface ProductVariantInput {
  readonly sku: string;
  readonly price: number | null;
  readonly compareAtPrice: number | null;
  readonly options: Readonly<Record<string, string>>;
  readonly isActive?: boolean;
  readonly imageMediaId?: string | null;
}

export interface CatalogConfiguration {
  readonly options: readonly {
    readonly id: string;
    readonly name: string;
    readonly values: readonly { readonly id: string; readonly label: string }[];
  }[];
  readonly variants: readonly {
    readonly id: string;
    readonly sku: string;
    readonly price: number | null;
    readonly compareAtPrice: number | null;
    readonly selections: Readonly<Record<string, string>>;
    readonly isActive: boolean;
    readonly imageMediaId: string | null;
    readonly trackInventory: boolean;
    readonly quantity: number | null;
    readonly inventoryVersion: string | null;
    readonly inventoryOperationId: string;
    readonly images: readonly ProductMediaDto[];
    readonly weight: number | null;
    readonly width: number | null;
    readonly height: number | null;
    readonly length: number | null;
  }[];
  readonly defaultVariantId: string;
}

export interface CreateProduct {
  readonly productTypeId: string;
  readonly productTypeVersion: string;
  readonly content: ProductContent;
  readonly options: readonly ProductOptionInput[];
  readonly variants: readonly ProductVariantInput[];
  readonly fulfillmentKind: ProductFulfillmentKind;
  readonly defaultVariantSku?: string | null;
  readonly configuration?: CatalogConfiguration;
}

export interface EditProduct {
  readonly id: string;
  readonly version: string;
  readonly productTypeVersion: string;
  readonly content: ProductContent;
}

export interface SaveProductEditor extends EditProduct {
  readonly configuration?: CatalogConfiguration;
  readonly addedOptions: readonly ProductOptionInput[];
  readonly optionEdits: readonly {
    readonly optionId: string;
    readonly name: string;
    readonly sortOrder: number;
    readonly addValues: readonly { readonly code: string; readonly label: string }[];
    readonly values: readonly {
      readonly id: string;
      readonly label: string;
      readonly sortOrder: number;
    }[];
  }[];
  readonly variantEdits: readonly {
    readonly variantId: string;
    readonly price: number | null;
    readonly compareAtPrice: number | null;
    readonly isActive: boolean;
    readonly imageMediaId: string | null;
  }[];
  readonly addedVariants: readonly ProductVariantInput[];
  readonly defaultVariantSku: string;
}

export interface BulkProductStatus {
  readonly items: readonly { readonly id: string; readonly version: string }[];
  readonly status: ProductStatus;
}

export interface BulkProductStatusResult {
  readonly items: readonly {
    readonly id: string;
    readonly status: ProductStatus;
    readonly version: string;
  }[];
}

export interface AddProductVariant {
  readonly productId: string;
  readonly version: string;
  readonly variant: ProductVariantInput;
}

export interface EditProductVariant {
  readonly productId: string;
  readonly variantId: string;
  readonly version: string;
  readonly price: number | null;
  readonly compareAtPrice: number | null;
  readonly isActive: boolean;
  readonly imageMediaId: string | null;
}

export interface EditProductOption {
  readonly productId: string;
  readonly optionId: string;
  readonly version: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly addValues: readonly { readonly code: string; readonly label: string }[];
  readonly values: readonly {
    readonly id: string;
    readonly label: string;
    readonly sortOrder: number;
  }[];
}

export interface ChangeProductStatus {
  readonly id: string;
  readonly version: string;
  readonly status: ProductStatus;
}

export type ProductCategoryLookup = Pick<CategoryDto, 'id' | 'name' | 'isActive'>;
type ProductFieldChoice = Pick<ProductFieldChoiceDto, 'id' | 'label' | 'isActive'>;
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

interface ProductSelectOption<T = string | null> {
  readonly label: string;
  readonly value: T;
}

export interface ListQuery {
  readonly q: string;
  readonly page: number;
}

export interface ProductListQuery extends ListQuery {
  readonly status: number | null;
  readonly pageSize: number;
  readonly categoryId?: string;
  readonly productTypeId?: string;
  readonly fulfillmentKind?: number;
  readonly inStock?: boolean;
  readonly minimumPrice?: number;
  readonly maximumPrice?: number;
  readonly sortBy?: 'name' | 'price';
  readonly sortDirection?: 'asc';
}

export const PRODUCT_LIMITS = {
  name: 256,
  slug: 200,
  description: 20000,
  sku: 100,
} as const;

const PRODUCT_SLUG_PATTERN = /^[a-z0-9-]+$/u;
export const PRODUCT_PAGE_SIZES: number[] = [10, 20, 50];
export const PRODUCT_SEARCH_DELAY_MS = 250;
export const PRODUCT_OPTION_LIMIT = 3;
export const PRODUCT_VARIANT_LIMIT = 50;

export const PRODUCT_STATUS_LABELS: Readonly<Record<ProductStatus, string>> = {
  [ProductStatus.Draft]: 'Bản nháp',
  [ProductStatus.Published]: 'Đã xuất bản',
  [ProductStatus.Archived]: 'Đã lưu trữ',
};

export const PRODUCT_STATUS_OPTIONS: ProductSelectOption<ProductStatus | null>[] = [
  { label: 'Tất cả trạng thái', value: null },
  { label: PRODUCT_STATUS_LABELS[ProductStatus.Draft], value: ProductStatus.Draft },
  { label: PRODUCT_STATUS_LABELS[ProductStatus.Published], value: ProductStatus.Published },
  { label: PRODUCT_STATUS_LABELS[ProductStatus.Archived], value: ProductStatus.Archived },
];

export const PRODUCT_FULFILLMENT_OPTIONS: ProductSelectOption<ProductFulfillmentKind>[] = [
  { label: 'Hàng vật lý', value: ProductFulfillmentKind.Physical },
  { label: 'Nội dung số riêng', value: ProductFulfillmentKind.DigitalUnique },
  { label: 'Nội dung số dùng chung', value: ProductFulfillmentKind.DigitalShared },
  { label: 'Gia hạn thủ công', value: ProductFulfillmentKind.ManualExtension },
];

export const PRODUCT_LIST_FULFILLMENT_OPTIONS: ProductSelectOption<ProductFulfillmentKind | null>[] =
  [{ label: 'Tất cả cách giao', value: null }, ...PRODUCT_FULFILLMENT_OPTIONS];

export const PRODUCT_STOCK_FILTER_OPTIONS: ProductSelectOption<boolean | null>[] = [
  { label: 'Tất cả khả dụng', value: null },
  { label: 'Có sẵn', value: true },
  { label: 'Chưa khả dụng', value: false },
];

export const PRODUCT_SORT_OPTIONS: ProductSelectOption<string>[] = [
  { label: 'Cập nhật mới nhất', value: 'modified:desc' },
  { label: 'Cập nhật cũ nhất', value: 'modified:asc' },
  { label: 'Tên A → Z', value: 'name:asc' },
  { label: 'Tên Z → A', value: 'name:desc' },
  { label: 'Giá tăng dần', value: 'price:asc' },
  { label: 'Giá giảm dần', value: 'price:desc' },
];

export const PRODUCT_FIELD_ALIASES = {
  'Content.Name': 'name',
  'Content.Slug': 'slug',
  'Content.Description': 'description',
  'Content.CategoryIds': 'categoryIds',
  'content.name': 'name',
  'content.slug': 'slug',
  'content.description': 'description',
  'content.categoryIds': 'categoryIds',
  'Variants[0].Sku': 'sku',
  'Variants[0].Price': 'price',
  'variants[0].sku': 'sku',
  'variants[0].price': 'price',
} as const;

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

export type ProductFieldControlValue = string | number | boolean | null;

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
