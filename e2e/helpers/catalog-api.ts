import { expect, test as base, type BrowserContext, type Page, type Route } from '@playwright/test';

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
}

interface ProductWrite {
  version?: string;
  productTypeId?: string;
  fulfillmentKind?: number;
  content: Pick<Product, 'name' | 'slug' | 'description' | 'categoryIds' | 'fields' | 'media'>;
  variants?: { sku: string; price: number }[];
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
    const body = request.postData() ? (request.postDataJSON() as Record<string, unknown>) : null;
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
    if (path === 'products/search' && method === 'POST') {
      const pageNumber = Number(body?.['pageNumber'] ?? 1);
      const pageSize = Number(body?.['pageSize'] ?? 10);
      const query = slug(String(body?.['search'] ?? ''));
      const items = products.filter(
        (product) =>
          (!query || slug(product.name).includes(query)) &&
          (!body?.['status'] || product.status === body['status']),
      );
      return reply(route, {
        items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize).map((product) => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          status: product.status,
          fromPrice: product.variants[0]?.price ?? null,
          inStock: true,
          fulfillmentKind: product.fulfillmentKind,
        })),
        total: items.length,
        pageNumber,
        pageSize,
      });
    }
    if (path === 'products' && method === 'POST') {
      const input = body as unknown as ProductWrite;
      const product: Product = {
        ...structuredClone(products[0]!),
        ...input.content,
        id: id(3, products.length),
        productTypeId: input.productTypeId!,
        fulfillmentKind: input.fulfillmentKind!,
        status: 1,
        version: `created-${++version}`,
        variants: [
          {
            ...structuredClone(products[0]!.variants[0]!),
            id: id(4, products.length),
            sku: input.variants![0]!.sku,
            price: input.variants![0]!.price,
          },
        ],
      };
      products.push(product);
      return reply(route, product);
    }
    if (path.startsWith('products/')) {
      const product = products.find((item) => item.id === path.split('/')[1]);
      if (!product) return reply(route, { status: 404 }, 404);
      if (method === 'GET') return reply(route, product);
      if (method === 'PUT') {
        if (rejectSave) {
          rejectSave = false;
          return conflict(route);
        }
        const input = body as unknown as ProductWrite;
        if (input.version !== product.version) return conflict(route);
        Object.assign(product, input.content, { version: `saved-${++version}` });
        return reply(route, product);
      }
      if (path.endsWith('/status') && method === 'POST') {
        if (body?.['version'] !== product.version) return conflict(route);
        product.status = Number(body['status']);
        product.version = `status-${++version}`;
        return reply(route, product);
      }
    }
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
