import { readFile } from 'node:fs/promises';
import { test as base, expect, request, type APIRequestContext, type Page } from '@playwright/test';

export interface LiveCredentials {
  email: string;
  password: string;
}

export interface LiveActor extends LiveCredentials {
  userId: string;
  role: string;
}

export interface LiveScenario {
  orderId: string;
  renewalId: string | null;
  productId: string;
  variantId: string;
  customerId: string;
  customerKey: string;
  targetAccountIdentifier?: string | null;
  expectedDigitalContents?: string[] | null;
}

export interface LiveStorefrontScenario {
  physicalProductId: string;
  physicalSlug: string;
  physicalName: string;
  physicalVariantId: string;
  digitalProductId: string;
  digitalSlug: string;
  digitalName: string;
  digitalVariantId: string;
  digitalContent: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface LiveManifest {
  schemaVersion: 1;
  runId: string;
  database: string;
  migrations: string[];
  backendUrl: string;
  credentials: { admin: LiveCredentials; basic: LiveCredentials };
  actors: Record<string, LiveActor>;
  scenarios: Record<string, LiveScenario>;
  storefront: LiveStorefrontScenario;
  products: { id: string; slug: string; name: string; version: string; productTypeId: string }[];
  categories: { id: string; slug: string; name: string; version: string }[];
  productTypes: { id: string; code: string; name: string; version: string }[];
  orders: {
    id: string;
    number: string;
    version: string;
    status: number;
    paymentStatus: number;
    fulfillmentStatus: number;
  }[];
}

export const test = base.extend<
  { liveApi: APIRequestContext; basicApi: APIRequestContext },
  { live: LiveManifest }
>({
  live: [
    async ({}, use) => {
      const path = process.env['LIVE_ACCEPTANCE_MANIFEST'];
      if (!path || !process.env['LIVE_BASE_URL']) {
        throw new Error('Run live tests through node scripts/live-acceptance.mjs.');
      }
      const manifest = JSON.parse(await readFile(path, 'utf8')) as LiveManifest;
      expect(manifest.schemaVersion).toBe(1);
      expect(manifest.database).toMatch(/^boilerate_test_[a-f0-9]{32}$/u);
      expect(manifest.migrations.length, 'the isolated database was migrated').toBeGreaterThan(0);
      expect(
        manifest.migrations.some((migration) => migration.endsWith('_WebflowCatalogEditor')),
      ).toBe(true);
      await use(manifest);
    },
    { scope: 'worker' },
  ],
  liveApi: async ({ live, baseURL }, use) => {
    const api = await apiAs(baseURL!, live.credentials.admin);
    await use(api);
    await api.dispose();
  },
  basicApi: async ({ live, baseURL }, use) => {
    const api = await apiAs(baseURL!, live.credentials.basic);
    await use(api);
    await api.dispose();
  },
});

export async function apiAs(baseURL: string, credentials: LiveCredentials) {
  const login = await request.newContext({ baseURL });
  try {
    let response = await login.post('/api/tokens/get', { data: credentials });
    if (response.status() !== 200) {
      await new Promise((r) => setTimeout(r, 500));
      response = await login.post('/api/tokens/get', { data: credentials });
    }
    expect(response.status(), 'live API login').toBe(200);
    const session = (await response.json()) as { token: string };
    expect(session.token).toBeTruthy();
    return await request.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${session.token}` },
    });
  } finally {
    await login.dispose();
  }
}

export async function signIn(page: Page, live: LiveManifest, path = '/admin/collections/products') {
  await signInAs(page, live.credentials.admin, path);
}

export async function signInAs(page: Page, credentials: LiveCredentials, path: string) {
  await page.goto(path);
  await expect(page.locator('#login-email')).toBeVisible();
  await page.locator('#login-email').fill(credentials.email);
  await page.locator('#login-password').fill(credentials.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.locator('.workspace')).toBeVisible();
}

export { expect };
