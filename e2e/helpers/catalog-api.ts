import { expect, test as base, type BrowserContext, type Page, type Route } from '@playwright/test';
import { Buffer } from 'node:buffer';

interface Category {
  id: string;
  version: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface FieldChoice {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
}

interface Field {
  id: string;
  code: string;
  dataType: number;
  label: string;
  helpText: string | null;
  isRequired: boolean;
  isFilterable: boolean;
  isActive: boolean;
  sortOrder: number;
  choices: FieldChoice[];
}

interface ProductType {
  id: string;
  version: string;
  code: string;
  name: string;
  isActive: boolean;
  fields: Field[];
}

interface Product {
  id: string;
  productTypeId: string;
  name: string;
  slug: string;
  description: string | null;
  status: number;
  version: string;
  categoryIds: string[];
  options: unknown[];
  variants: {
    id: string;
    sku: string;
    combinationKey: string;
    price: number | null;
    compareAtPrice: number | null;
    currency: string;
    isDefault: boolean;
    isActive: boolean;
    imageMediaId: string | null;
    inStock: boolean;
    selections: unknown[];
  }[];
  fields: unknown[];
  media: unknown[];
  fulfillmentKind: number;
  createdOn: string;
  modifiedOn: string;
}

interface ProductOption {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  values: { id: string; code: string; label: string; sortOrder: number }[];
}

interface ProductVariantInput {
  sku: string;
  price: number | null;
  compareAtPrice: number | null;
  options: Record<string, string>;
  isActive?: boolean;
  imageMediaId?: string | null;
}

interface ProductWrite {
  version?: string;
  productTypeId?: string;
  productTypeVersion?: string;
  fulfillmentKind?: number;
  content: Pick<Product, 'name' | 'slug' | 'description' | 'categoryIds' | 'fields' | 'media'>;
  options?: { code: string; name: string; values: { code: string; label: string }[] }[];
  variants?: ProductVariantInput[];
  defaultVariantSku?: string | null;
  optionEdits?: {
    optionId: string;
    name: string;
    sortOrder: number;
    addValues: { code: string; label: string }[];
    values: { id: string; label: string; sortOrder: number }[];
  }[];
  variantEdits?: {
    variantId: string;
    price: number | null;
    compareAtPrice: number | null;
    isActive: boolean;
    imageMediaId: string | null;
  }[];
  addedVariants?: ProductVariantInput[];
}

export interface ApiRequest {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
  authorization: string | undefined;
  requestedWith: string | undefined;
}

export interface CatalogApi {
  requests: ApiRequest[];
  unexpectedRequests: string[];
  products: Product[];
  categories: Category[];
  productTypes: ProductType[];
  rejectNextProductSave(): void;
  revokeSession(): void;
  setPermissions(grants: readonly string[]): void;
  failNextProductSave(status: number, errors?: Record<string, string[]>): void;
}

export const FIRST_PRODUCT_ID = '30000000-0000-0000-0000-000000000001';

const names = [
  'Túi Everyday Tote',
  'Đèn bàn Studio',
  'Tai nghe Quiet Hours',
  'Ghế Form Lounge',
  'Bình gốm Organic',
  'Máy ảnh Pocket Film',
  'Giày Daily Runner',
  'Sổ tay Field Notes',
  'Túi Weekender Canvas',
  'Đèn đọc sách Arc',
  'Bình gốm Still',
  'Ghế gỗ Sunday',
  'Sổ tay Morning Pages',
  'Tai nghe Studio Pro',
];
const prices = [
  690000, 1290000, 2490000, 4590000, 450000, 3690000, 1590000, 190000, 1190000, 890000, 590000,
  3290000, 250000, 3290000,
];
const categoryNames = [
  'Phụ kiện',
  'Không gian sống',
  'Công nghệ',
  'Nội thất',
  'Thời trang',
  'Văn phòng phẩm',
];

function id(group: number, index: number): string {
  return `${group}0000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`;
}

function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/gu, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

async function installCatalogApi(context: BrowserContext): Promise<CatalogApi> {
  let version = 1;
  let rejectSave = false;
  let saveFailure: { status: number; errors?: Record<string, string[]> } | null = null;
  let sessionActive = false;
  let refreshVersion = 0;
  let refreshCookie = '';
  let mediaSequence = 100;
  const mediaAssets = new Map<string, Buffer>();
  const imageBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  );
  const categories = categoryNames.map((name, index): Category => ({
    id: id(2, index),
    version: `category-${index}-v1`,
    name,
    slug: slug(name),
    description: `Danh mục ${name.toLowerCase()}.`,
    parentId: null,
    sortOrder: index,
    isActive: true,
  }));
  const productTypes: ProductType[] = [
    {
      id: id(1, 0),
      version: 'type-1-v1',
      code: 'DEMO-ESSENTIALS',
      name: 'Đồ dùng thiết yếu',
      isActive: true,
      fields: [],
    },
    {
      id: id(1, 1),
      version: 'type-2-v1',
      code: 'DEMO-ELECTRONICS',
      name: 'Thiết bị công nghệ',
      isActive: true,
      fields: [],
    },
  ];
  const products = names.map((name, index): Product => ({
    id: id(3, index),
    productTypeId: productTypes[0]!.id,
    name,
    slug: slug(name),
    description:
      'Thiết kế tinh giản, chất liệu được lựa chọn kỹ lưỡng. Một món đồ nhỏ cho nhịp sống có chủ đích.',
    status: [2, 5, 8, 11, 13].includes(index) ? 1 : index === 10 ? 3 : 2,
    version: `product-${index}-v1`,
    categoryIds: [categories[index % categories.length]!.id],
    options: [],
    variants: [
      {
        id: id(4, index),
        sku: `DEMO-SKU-${String(index + 1).padStart(3, '0')}`,
        combinationKey: '',
        price: prices[index]!,
        compareAtPrice: null,
        currency: 'VND',
        isDefault: true,
        isActive: true,
        imageMediaId: null,
        inStock: true,
        selections: [],
      },
    ],
    fields: [],
    media: [],
    fulfillmentKind: 1,
    createdOn: '2026-10-01T00:00:00.000Z',
    modifiedOn: new Date(Date.UTC(2026, 9, 21, 10) - index * 60_000).toISOString(),
  }));
  const api: CatalogApi = {
    setPermissions: (grants) => {
      permissions = [...grants];
    },
    failNextProductSave: (status, errors) => {
      saveFailure = { status, errors };
    },
    requests: [],
    unexpectedRequests: [],
    products,
    categories,
    productTypes,
    rejectNextProductSave: () => {
      rejectSave = true;
    },
    revokeSession: () => {
      sessionActive = false;
    },
  };
  let permissions = [
    'Product.View',
    'Product.Create',
    'Product.Update',
    'Product.Publish',
    'Category.View',
    'Category.Create',
    'Category.Update',
    'Category.Delete',
    'ProductType.View',
    'ProductType.Create',
    'ProductType.Update',
    'Price.Update',
    'Inventory.View',
  ].map((permission) => `Permissions.${permission}`);
  const reply = (route: Route, json: unknown, status = 200, headers?: Record<string, string>) =>
    route.fulfill({ status, json, headers });
  const cookie = (value: string, maxAge: number) =>
    `boilerate.refresh=${value}; Path=/api/tokens/session; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
  const sessionResponse = () => ({
    userId: id(8, 0),
    token: 'browser-test-access-token',
    sessionId: id(9, 0),
    accessTokenExpiresAt: '2099-01-01T00:00:00Z',
  });
  const refreshSession = (route: Route) => {
    refreshCookie = `browser-test-refresh-${++refreshVersion}`;
    return reply(route, sessionResponse(), 200, {
      'set-cookie': cookie(refreshCookie, 30 * 24 * 60 * 60),
    });
  };
  const conflict = (route: Route) =>
    reply(
      route,
      { status: 409, title: 'Conflict', detail: 'Record changed; reload before editing.' },
      409,
    );
  const forbidden = (route: Route) => reply(route, { status: 403, title: 'Forbidden' }, 403);
  const invalid = (route: Route, message: string) =>
    reply(route, { status: 422, title: 'Validation failed', errors: { Product: [message] } }, 422);
  const can = (functionCode: string, action: string) =>
    permissions.includes(`Permissions.${functionCode}.${action}`);
  const priceOf = (product: Product): number | null => {
    const prices = product.variants
      .filter((variant) => variant.isActive && variant.price !== null)
      .map((variant) => variant.price as number);
    return prices.length ? Math.min(...prices) : null;
  };
  const inStock = (product: Product) =>
    product.variants.some((variant) => variant.isActive && variant.inStock);
  const mediaId = (product: Product) => {
    const gallery = product.media as { mediaAssetId: string; sortOrder: number }[];
    return (
      product.variants.find((variant) => variant.isDefault)?.imageMediaId ??
      [...gallery].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.mediaAssetId ??
      null
    );
  };
  const summary = (product: Product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    status: product.status,
    fromPrice: priceOf(product),
    inStock: inStock(product),
    fulfillmentKind: product.fulfillmentKind,
    productTypeId: product.productTypeId,
    productTypeName: productTypes.find((type) => type.id === product.productTypeId)?.name ?? '',
    thumbnailMediaId: mediaId(product),
    version: product.version,
    modifiedOn: product.modifiedOn,
  });
  const variantFrom = (
    input: ProductVariantInput,
    options: ProductOption[],
    index: number,
  ): Product['variants'][number] => ({
    id: id(4, products.length * 1000 + index + version * 100),
    sku: input.sku,
    combinationKey: Object.entries(input.options)
      .sort()
      .map(([key, value]) => `${key}=${value}`)
      .join('|'),
    price: input.price,
    compareAtPrice: input.compareAtPrice,
    currency: 'VND',
    isDefault: false,
    isActive: input.isActive ?? true,
    imageMediaId: input.imageMediaId ?? null,
    inStock: false,
    selections: Object.entries(input.options).map(([code, valueCode]) => {
      const option = options.find((option) => option.code === code);
      const value = option?.values.find((value) => value.code === valueCode);
      return { optionId: option?.id ?? '', optionValueId: value?.id ?? '' };
    }),
  });
  const invalidProduct = (product: Product): string | null => {
    if (products.some((other) => other.id !== product.id && other.slug === product.slug))
      return 'Đường dẫn đã được sử dụng.';
    if (
      !product.variants.length ||
      product.variants.filter((variant) => variant.isDefault && variant.isActive).length !== 1
    )
      return 'Sản phẩm cần một SKU mặc định đang hoạt động.';
    const seen = new Set<string>();
    const combinations = new Set<string>();
    const gallery = product.media as { mediaAssetId: string }[];
    if (
      gallery.length > 30 ||
      new Set(gallery.map((item) => item.mediaAssetId)).size !== gallery.length
    )
      return 'Danh sách ảnh không hợp lệ.';
    for (const variant of product.variants) {
      const sku = variant.sku.toUpperCase();
      if (
        seen.has(sku) ||
        products.some(
          (other) =>
            other.id !== product.id &&
            other.variants.some((item) => item.sku.toUpperCase() === sku),
        )
      )
        return 'Mã SKU đã tồn tại.';
      seen.add(sku);
      const combination = (variant.selections as { optionId: string; optionValueId: string }[])
        .map((selection) => `${selection.optionId}=${selection.optionValueId}`)
        .sort()
        .join('|');
      if (combinations.has(combination)) return 'Tổ hợp SKU đã tồn tại.';
      combinations.add(combination);
      if (
        variant.imageMediaId &&
        !gallery.some((item) => item.mediaAssetId === variant.imageMediaId)
      )
        return 'Ảnh SKU phải nằm trong ảnh sản phẩm.';
      if (variant.price !== null && (!Number.isInteger(variant.price) || variant.price < 0))
        return 'Giá VND phải là số nguyên không âm.';
      if (
        variant.compareAtPrice !== null &&
        (variant.price === null || variant.compareAtPrice <= variant.price)
      )
        return 'Giá gốc phải lớn hơn giá bán.';
    }
    return null;
  };
  const fields = (inputs: Field[], start = 0): Field[] =>
    inputs.map((field, index) => ({
      ...field,
      id: field.id || id(5, start + index),
      code: field.code.toUpperCase(),
      isActive: field.isActive ?? true,
      sortOrder: field.sortOrder ?? index,
      choices: (field.choices ?? []).map((choice, choiceIndex) => ({
        ...choice,
        id: choice.id || id(6, start * 100 + index * 10 + choiceIndex),
        code: choice.code.toUpperCase(),
        isActive: choice.isActive ?? true,
        sortOrder: choice.sortOrder ?? choiceIndex,
      })),
    }));

  // Every API request is intercepted here. Browser regression never writes to a real database.
  await context.route(/\/api\//u, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\//u, '');
    const method = request.method();
    const authorization = request.headers()['authorization'];
    const requestedWith = request.headers()['x-requested-with'];
    const body =
      request.postData() && request.headers()['content-type']?.includes('application/json')
        ? (request.postDataJSON() as Record<string, unknown>)
        : null;
    api.requests.push({
      method,
      path,
      body: path.startsWith('tokens/') ? null : body,
      authorization,
      requestedWith,
    });

    if (path === 'tokens/session' || path === 'tokens/session/refresh') {
      if (requestedWith !== 'XMLHttpRequest') {
        api.unexpectedRequests.push(`${method} ${path}: missing request header`);
        return reply(route, { status: 403, title: 'Forbidden' }, 403);
      }
      if (path === 'tokens/session' && method === 'POST') {
        sessionActive = true;
        return refreshSession(route);
      }
      if (path === 'tokens/session' && method === 'DELETE') {
        sessionActive = false;
        refreshCookie = '';
        return reply(route, null, 200, { 'set-cookie': cookie('', 0) });
      }
      if (path === 'tokens/session/refresh' && method === 'POST') {
        const requestCookie = request.headers()['cookie'] ?? '';
        if (
          !sessionActive ||
          !refreshCookie ||
          !requestCookie.split('; ').includes(`boilerate.refresh=${refreshCookie}`)
        ) {
          return reply(route, { status: 401, title: 'Unauthorized' }, 401, {
            'set-cookie': cookie('', 0),
          });
        }
        return refreshSession(route);
      }
    }
    if (!sessionActive || authorization !== 'Bearer browser-test-access-token')
      return reply(route, { status: 401, title: 'Unauthorized' }, 401);
    if (saveFailure && method === 'PUT' && path.startsWith('products/')) {
      const failure = saveFailure;
      saveFailure = null;
      return reply(
        route,
        {
          status: failure.status,
          title: 'Save rejected',
          detail: 'Không thể lưu bản ghi.',
          errors: failure.errors,
        },
        failure.status,
      );
    }
    if (path === 'personal/permissions' && method === 'GET') return reply(route, permissions);
    if (path === 'personal/authorization' && method === 'GET')
      return reply(route, { permissions, isCentralAdmin: false });
    if (path === 'media' && method === 'POST') {
      if (!can('Product', 'Update')) return forbidden(route);
      const bytes = request.postDataBuffer();
      if (!bytes?.length || !request.headers()['content-type']?.startsWith('multipart/form-data'))
        return invalid(route, 'Chọn tệp ảnh.');
      const mediaId = id(7, ++mediaSequence);
      mediaAssets.set(mediaId, imageBytes);
      return reply(route, {
        id: mediaId,
        contentType: 'image/png',
        size: imageBytes.length,
        state: 'Ready',
        version: `media-${++version}`,
      });
    }
    if (path.startsWith('media/') && method === 'GET') {
      if (!can('Product', 'View')) return forbidden(route);
      const mediaId = path.split('/')[1] ?? '';
      const linked = products.some((product) =>
        (product.media as { mediaAssetId: string }[]).some((item) => item.mediaAssetId === mediaId),
      );
      const media = mediaAssets.get(mediaId) ?? (linked ? imageBytes : null);
      if (!media) return reply(route, { status: 404 }, 404);
      return route.fulfill({
        body: media,
        contentType: 'image/png',
        headers: { 'cache-control': 'no-store' },
      });
    }
    if (path === 'inventory' && method === 'GET')
      return reply(route, { items: [], total: 0, pageNumber: 1, pageSize: 100 });
    if (path === 'products/search' && method === 'POST') {
      if (!can('Product', 'View')) return forbidden(route);
      const pageNumber = Number(body?.['pageNumber'] ?? 1);
      const pageSize = Number(body?.['pageSize'] ?? 10);
      const query = slug(String(body?.['search'] ?? ''));
      const items = products.filter(
        (product) =>
          (!query || slug(`${product.name} ${product.slug}`).includes(query)) &&
          (!body?.['status'] || product.status === body['status']) &&
          (!body?.['categoryId'] || product.categoryIds.includes(String(body['categoryId']))) &&
          (!body?.['productTypeId'] || product.productTypeId === body['productTypeId']) &&
          (!body?.['fulfillmentKind'] || product.fulfillmentKind === body['fulfillmentKind']) &&
          (typeof body?.['inStock'] !== 'boolean' || inStock(product) === body['inStock']) &&
          (body?.['minimumPrice'] == null ||
            (priceOf(product) !== null && priceOf(product)! >= Number(body['minimumPrice']))) &&
          (body?.['maximumPrice'] == null ||
            (priceOf(product) !== null && priceOf(product)! <= Number(body['maximumPrice']))),
      );
      const direction = body?.['sortDirection'] === 'asc' ? 1 : -1;
      items.sort((a, b) => {
        const order =
          body?.['sortBy'] === 'name'
            ? a.name.localeCompare(b.name, 'vi')
            : body?.['sortBy'] === 'price'
              ? (priceOf(a) ?? -1) - (priceOf(b) ?? -1)
              : a.modifiedOn.localeCompare(b.modifiedOn);
        return order * direction || a.id.localeCompare(b.id);
      });
      return reply(route, {
        items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize).map(summary),
        total: items.length,
        pageNumber,
        pageSize,
      });
    }
    if (path === 'products/bulk-status' && method === 'POST') {
      if (!can('Product', 'Publish')) return forbidden(route);
      const targets = body?.['items'] as { id: string; version: string }[] | undefined;
      const status = Number(body?.['status']);
      if (
        !targets?.length ||
        targets.length > 100 ||
        new Set(targets.map((target) => target.id)).size !== targets.length ||
        ![1, 2, 3].includes(status)
      )
        return invalid(route, 'Danh sách trạng thái không hợp lệ.');
      const matches = targets.map((target) => products.find((product) => product.id === target.id));
      if (matches.some((product, index) => !product || product.version !== targets[index]?.version))
        return conflict(route);
      if (
        status === 2 &&
        matches.some((product) =>
          product?.variants.some((variant) => variant.isActive && variant.price === null),
        )
      )
        return invalid(route, 'Đặt giá cho SKU trước khi xuất bản.');
      const changed = matches.map((product) => {
        if (!product) throw new Error('Fixture product missing');
        product.status = status;
        product.version = `status-${++version}`;
        product.modifiedOn = new Date().toISOString();
        return { id: product.id, status: product.status, version: product.version };
      });
      return reply(route, { items: changed });
    }
    if (path === 'products' && method === 'POST') {
      if (!can('Product', 'Create')) return forbidden(route);
      const input = body as unknown as ProductWrite;
      const options: ProductOption[] = (input.options ?? []).map((option, index) => ({
        id: id(5, products.length * 100 + index),
        code: option.code,
        name: option.name,
        sortOrder: index,
        values: option.values.map((value, valueIndex) => ({
          ...value,
          id: id(6, products.length * 1000 + index * 100 + valueIndex),
          sortOrder: valueIndex,
        })),
      }));
      const variants = (input.variants ?? []).map((variant, index) =>
        variantFrom(variant, options, index),
      );
      const defaultSku = input.defaultVariantSku ?? variants[0]?.sku;
      variants.forEach((variant) => (variant.isDefault = variant.sku === defaultSku));
      const product: Product = {
        ...structuredClone(products[0]!),
        ...input.content,
        id: id(3, products.length),
        productTypeId: input.productTypeId!,
        fulfillmentKind: input.fulfillmentKind!,
        status: 1,
        version: `created-${++version}`,
        options,
        variants,
        createdOn: new Date().toISOString(),
        modifiedOn: new Date().toISOString(),
      };
      const validation = invalidProduct(product);
      if (validation) return invalid(route, validation);
      products.push(product);
      return reply(route, product);
    }
    if (path.startsWith('products/')) {
      const product = products.find((item) => item.id === path.split('/')[1]);
      if (!product) return reply(route, { status: 404 }, 404);
      if (method === 'GET') return reply(route, product);
      if (method === 'PUT') {
        if (!can('Product', 'Update')) return forbidden(route);
        if (rejectSave) {
          rejectSave = false;
          return conflict(route);
        }
        const input = body as unknown as ProductWrite;
        if (input.version !== product.version) return conflict(route);
        if (
          input.productTypeVersion &&
          productTypes.find((type) => type.id === product.productTypeId)?.version !==
            input.productTypeVersion
        )
          return conflict(route);
        const draft = structuredClone(product);
        Object.assign(draft, input.content);
        if (path.endsWith('/editor')) {
          const options = draft.options as ProductOption[];
          for (const edit of input.optionEdits ?? []) {
            const option = options.find((option) => option.id === edit.optionId);
            if (!option) return invalid(route, 'Lựa chọn không tồn tại.');
            option.name = edit.name;
            option.sortOrder = edit.sortOrder;
            for (const valueEdit of edit.values) {
              const value = option.values.find((value) => value.id === valueEdit.id);
              if (!value) return invalid(route, 'Giá trị lựa chọn không tồn tại.');
              Object.assign(value, { label: valueEdit.label, sortOrder: valueEdit.sortOrder });
            }
            for (const value of edit.addValues) {
              if (option.values.some((current) => current.code === value.code))
                return invalid(route, 'Mã giá trị đã tồn tại.');
              option.values.push({
                ...value,
                id: id(6, ++mediaSequence + 10_000),
                sortOrder: option.values.length,
              });
            }
          }
          for (const edit of input.variantEdits ?? []) {
            const variant = draft.variants.find((variant) => variant.id === edit.variantId);
            if (!variant) return invalid(route, 'SKU không tồn tại.');
            if (
              !can('Price', 'Update') &&
              (variant.price !== edit.price || variant.compareAtPrice !== edit.compareAtPrice)
            )
              return forbidden(route);
            Object.assign(variant, {
              price: edit.price,
              compareAtPrice: edit.compareAtPrice,
              isActive: edit.isActive,
              imageMediaId: edit.imageMediaId,
            });
          }
          for (const added of input.addedVariants ?? []) {
            if (!can('Price', 'Update') && (added.price !== null || added.compareAtPrice !== null))
              return forbidden(route);
            const variant = variantFrom(added, options, draft.variants.length);
            const selections = variant.selections as { optionId: string; optionValueId: string }[];
            if (
              selections.length !== options.length ||
              selections.some((selection) => !selection.optionId || !selection.optionValueId)
            )
              return invalid(route, 'Tổ hợp SKU không hợp lệ.');
            draft.variants.push(variant);
          }
          if (input.defaultVariantSku)
            draft.variants.forEach(
              (variant) => (variant.isDefault = variant.sku === input.defaultVariantSku),
            );
        }
        const validation = invalidProduct(draft);
        if (validation) return invalid(route, validation);
        Object.assign(product, draft, {
          version: `saved-${++version}`,
          modifiedOn: new Date().toISOString(),
        });
        return reply(route, product);
      }
      if (path.endsWith('/status') && method === 'POST') {
        if (!can('Product', 'Publish')) return forbidden(route);
        if (body?.['version'] !== product.version) return conflict(route);
        if (
          Number(body['status']) === 2 &&
          product.variants.some((variant) => variant.isActive && variant.price === null)
        )
          return invalid(route, 'Đặt giá cho SKU trước khi xuất bản.');
        product.status = Number(body['status']);
        product.version = `status-${++version}`;
        product.modifiedOn = new Date().toISOString();
        return reply(route, product);
      }
    }
    if (path === 'categories/summaries' && method === 'GET')
      return reply(
        route,
        categories.map((category) => ({
          id: category.id,
          productCount: products.filter((product) => product.categoryIds.includes(category.id))
            .length,
        })),
      );
    if (path === 'categories' && method === 'GET') return reply(route, categories);
    if (path === 'categories' && method === 'POST') {
      const category = {
        ...(body as unknown as Category),
        id: id(2, categories.length),
        version: `created-${++version}`,
      };
      categories.push(category);
      return reply(route, category);
    }
    if (path.startsWith('categories/')) {
      const index = categories.findIndex((item) => item.id === path.split('/')[1]);
      const category = categories[index];
      if (!category) return reply(route, { status: 404 }, 404);
      if (method === 'PUT') {
        if (body?.['version'] !== category.version) return conflict(route);
        Object.assign(category, body, { version: `saved-${++version}` });
        return reply(route, category);
      }
      if (method === 'DELETE') {
        categories.splice(index, 1);
        return reply(route, true);
      }
    }
    if (path === 'product-types' && method === 'GET') return reply(route, productTypes);
    if (path === 'product-types' && method === 'POST') {
      const input = body as unknown as ProductType;
      const productType = {
        ...input,
        id: id(1, productTypes.length),
        version: `created-${++version}`,
        isActive: true,
        fields: fields(input.fields),
      };
      productTypes.push(productType);
      return reply(route, productType);
    }
    if (path.startsWith('product-types/')) {
      const productType = productTypes.find((item) => item.id === path.split('/')[1]);
      if (!productType) return reply(route, { status: 404 }, 404);
      if (method === 'GET') return reply(route, productType);
      if (method === 'PUT') {
        if (body?.['version'] !== productType.version) return conflict(route);
        const updates = body['fields'] as Field[];
        productType.name = String(body['name']);
        productType.isActive = Boolean(body['isActive']);
        productType.version = `saved-${++version}`;
        productType.fields = [
          ...productType.fields.map((field) => ({
            ...field,
            ...updates.find((update) => update.id === field.id),
          })),
          ...fields(body['addFields'] as Field[], productType.fields.length),
        ];
        return reply(route, productType);
      }
    }
    api.unexpectedRequests.push(`${method} ${path}`);
    return reply(route, { status: 501, title: 'Unexpected browser test request' }, 501);
  });
  return api;
}

export const test = base.extend<{ catalog: CatalogApi }>({
  catalog: [
    async ({ context }, use) => {
      const api = await installCatalogApi(context);
      await use(api);
      expect(api.unexpectedRequests).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';

export async function finishSignIn(page: Page): Promise<void> {
  await expect(page.locator('#login-email')).toBeVisible();
  await page.locator('#login-email').fill('browser-test@example.test');
  await page.locator('#login-password').fill('BrowserTestPassword!482');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.locator('.workspace')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

export async function ready(page: Page, path = '/admin/collections/products'): Promise<void> {
  await page.goto(path);
  await finishSignIn(page);
  await expect(page).toHaveURL(new RegExp(`${path}$`, 'u'));
}
