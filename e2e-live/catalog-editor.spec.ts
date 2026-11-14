import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, APIResponse, Locator, Page } from '@playwright/test';
import type { ProductDto } from '../src/app/api/catalog/models/product.dto';
import type {
  CatalogPage,
  DigitalStock,
  InventoryBalance,
  InventoryMovement,
} from '../src/app/api/inventory/models/inventory.dto';
import { addOption } from '../e2e/helpers/product-editor';
import { test, expect, signIn } from './fixtures';

const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);

async function body<T>(response: APIResponse): Promise<T> {
  expect(response.status(), await response.text()).toBe(200);
  return response.json() as Promise<T>;
}

async function prepareProduct(api: APIRequestContext, fulfillmentKind = 1) {
  const key = randomUUID().replaceAll('-', '');
  const type = await body<{ id: string; version: string }>(
    await api.post('/api/product-types', {
      data: { code: `EDITOR_${key}`, name: `Live editor type ${key}`, fields: [] },
    }),
  );
  const product = await body<ProductDto>(
    await api.post('/api/products', {
      data: {
        productTypeId: type.id,
        productTypeVersion: type.version,
        fulfillmentKind,
        content: {
          name: `Live editor ${key}`,
          slug: `live-editor-${key}`,
          description: null,
          categoryIds: [],
          fields: [],
          media: [],
        },
        options: [],
        variants: [{ sku: `LIVE_${key}`, price: 100000, compareAtPrice: null, options: {} }],
      },
    }),
  );
  return { product, key };
}

async function savedProduct(api: APIRequestContext, id: string) {
  return body<ProductDto>(await api.get(`/api/products/${id}`));
}

async function saveEditor(page: Page, id: string) {
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/products/${id}/editor`) &&
      response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.locator('.editor-save-status')).toContainText('Đã lưu');
}

async function openVariant(page: Page, color: string, occurrence = 0): Promise<Locator> {
  await page.locator('.wf-variant-row').filter({ hasText: color }).nth(occurrence).click();
  const detail = page.locator('.wf-detail-row');
  await expect(detail).toBeVisible();
  return detail;
}

test('live catalog editor: options, blank/duplicate SKU, prices, default, tracking and media persist with stable variant IDs', async ({
  page,
  live,
  liveApi,
}) => {
  test.setTimeout(150_000);
  const { product, key } = await prepareProduct(liveApi);
  const originalId = product.variants[0]!.id;
  await signIn(page, live, `/admin/collections/products/${product.id}`);
  await addOption(page, 'Màu sắc', ['Đỏ', 'Xanh']);
  await addOption(page, 'Kích cỡ', ['S', 'M']);
  await expect(page.locator('.wf-variant-row')).toHaveCount(4);
  const duplicateSku = `DUP_${key}`;
  for (const [color, occurrence, sku, price, quantity] of [
    ['Đỏ', 0, duplicateSku, 100000, 5],
    ['Đỏ', 1, duplicateSku, 110000, 6],
    ['Xanh', 0, '', 120000, 7],
  ] as const) {
    const detail = await openVariant(page, color, occurrence);
    await detail.locator('input[id^="variant-sku-"]').fill(sku);
    await detail.locator('input[id^="variant-price-"]').fill(String(price));
    await detail.locator('input[id^="variant-quantity-"]').fill(String(quantity));
    await detail.getByRole('button', { name: 'Đóng', exact: true }).click();
  }
  const detail = await openVariant(page, 'Xanh', 1);
  await detail.locator('input[id^="variant-sku-"]').fill('');
  await detail.locator('input[id^="variant-price-"]').fill('130000');
  await detail.locator('input[id^="variant-compare-"]').fill('150000');
  await detail.getByRole('switch', { name: /^Theo dõi tồn kho/u }).uncheck();
  await detail.getByRole('button', { name: 'Đặt mặc định', exact: true }).click();
  for (const [heading, filename] of [
    ['Ảnh biến thể', 'primary.png'],
    ['Ảnh bổ sung', 'additional.png'],
  ]) {
    const media = detail.locator(`.wf-media[aria-label="${heading}"]`);
    const upload = page.waitForResponse(
      (response) => response.url().endsWith('/api/media') && response.request().method() === 'POST',
    );
    await media
      .locator('input[type="file"]')
      .setInputFiles({ name: filename!, mimeType: 'image/png', buffer: pixel });
    expect((await upload).status()).toBe(200);
    await expect(media.locator('.wf-media-item')).toHaveCount(1);
  }
  await detail.getByRole('button', { name: 'Đóng', exact: true }).click();
  await saveEditor(page, product.id);
  const saved = await savedProduct(liveApi, product.id);
  expect(saved.options.map((option) => option.values.length)).toEqual([2, 2]);
  expect(saved.variants).toHaveLength(4);
  expect(saved.variants.filter((variant) => variant.sku === duplicateSku)).toHaveLength(2);
  expect(saved.variants.filter((variant) => variant.sku === '')).toHaveLength(2);
  expect(saved.variants.map((variant) => variant.price).sort()).toEqual([
    100000, 110000, 120000, 130000,
  ]);
  expect(saved.variants.find((variant) => variant.id === originalId)?.quantity).toBe(5);
  const defaultVariant = saved.variants.find((variant) => variant.isDefault)!;
  expect(defaultVariant).toMatchObject({
    price: 130000,
    compareAtPrice: 150000,
    trackInventory: false,
  });
  expect(defaultVariant.imageMediaId).toBeTruthy();
  expect(defaultVariant.images).toHaveLength(1);
  expect(saved.media).toHaveLength(2);
  const ids = saved.variants.map((variant) => variant.id).sort();
  await page.reload();
  await expect(page.locator('.wf-variant-row')).toHaveCount(4);
  await page.locator('.wf-option-summary').filter({ hasText: 'Màu sắc' }).click();
  const chip = page.locator('.wf-option-chip').filter({ hasText: 'Đỏ' });
  await chip.getByRole('button', { name: 'Thao tác với Đỏ', exact: true }).click();
  await chip.getByRole('button', { name: 'Đổi tên', exact: true }).click();
  await page.locator('#option-values').fill('Đỏ mới');
  await page.locator('#option-values').press('Enter');
  await page.getByRole('button', { name: 'Xong', exact: true }).click();
  await saveEditor(page, product.id);
  const renamed = await savedProduct(liveApi, product.id);
  expect(renamed.variants.map((variant) => variant.id).sort()).toEqual(ids);
  expect(renamed.variants.find((variant) => variant.isDefault)?.id).toBe(defaultVariant.id);
  expect(renamed.options[0]!.values.map((value) => value.id)).toEqual(
    saved.options[0]!.values.map((value) => value.id),
  );
  expect(renamed.options[0]!.values[0]!.label).toBe('Đỏ mới');
  await page.reload();
  await expect(page.locator('.wf-option-summary').filter({ hasText: 'Màu sắc' })).toContainText(
    'Đỏ mới',
  );
  await page
    .locator('.wf-variant-row')
    .filter({ hasText: 'Xanh' })
    .filter({ hasText: 'M' })
    .click();
  await expect(page.locator('.wf-detail-row')).toBeVisible();
  await expect(page.locator('.wf-detail-row .wf-media-item')).toHaveCount(2);
  await expect(
    page.locator('.wf-detail-row').getByRole('switch', { name: /^Theo dõi tồn kho/u }),
  ).not.toBeChecked();
});

test('live physical inventory: UI adjustment, ledger and operation replay preserve Reserved', async ({
  page,
  live,
  liveApi,
}) => {
  test.setTimeout(100_000);
  const { product, key } = await prepareProduct(liveApi);
  const balance = async () =>
    (
      await body<CatalogPage<InventoryBalance>>(
        await liveApi.get('/api/inventory', {
          params: { productId: product.id },
        }),
      )
    ).items[0]!;
  await signIn(page, live, `/admin/collections/products/${product.id}`);
  const open = async () =>
    page.getByRole('button', { name: `Tồn kho ${product.variants[0]!.sku}`, exact: true }).click();
  await open();
  await page.locator('#inventory-delta').fill('7');
  await page.locator('#inventory-reason').fill(`Live stock ${key}`);
  const adjustment = page.waitForResponse(
    (response) =>
      response.url().includes('/api/inventory/') && response.url().endsWith('/adjustments'),
  );
  await page.getByRole('button', { name: 'Ghi nhận điều chỉnh', exact: true }).click();
  const accepted = await adjustment;
  expect(accepted.status()).toBe(200);
  await expect(page.getByRole('cell', { name: `Live stock ${key}`, exact: true })).toBeVisible();
  const request = accepted.request().postDataJSON();
  const inventory = await balance();
  expect(inventory).toMatchObject({ onHand: 7, reserved: 0 });
  expect(
    (await liveApi.post(`/api/inventory/${inventory.id}/adjustments`, { data: request })).status(),
  ).toBe(200);
  expect((await balance()).onHand).toBe(7);
  const ledger = await body<CatalogPage<InventoryMovement>>(
    await liveApi.get(`/api/inventory/${inventory.id}/movements`),
  );
  expect(
    ledger.items.filter((movement) => movement.operationId === request.operationId),
  ).toHaveLength(1);
  await page.getByRole('button', { name: 'Đóng trình sửa', exact: true }).click();
  const current = await savedProduct(liveApi, product.id);
  await body(
    await liveApi.post(`/api/products/${product.id}/status`, {
      data: { id: product.id, version: current.version, status: 2 },
    }),
  );
  const cart = await body<{ version: string }>(await liveApi.get('/api/cart'));
  const ready = await body<{ version: string; total: number }>(
    await liveApi.put('/api/cart', {
      data: {
        version: cart.version,
        items: [{ variantId: product.variants[0]!.id, quantity: 2 }],
      },
    }),
  );
  await body(
    await liveApi.post('/api/orders/checkout', {
      data: {
        cartVersion: ready.version,
        operationId: randomUUID(),
        paymentMethod: 1,
        recipientName: 'Live stock owner',
        email: `stock-${key}@example.test`,
        phone: '0900000000',
        shippingAddress: 'Live test address',
        expectedTotal: ready.total,
      },
    }),
  );
  await page.reload();
  await open();
  await expect(page.getByLabel('Vận hành tồn kho', { exact: true })).toContainText('Đã giữ 2');
  let writes = 0;
  page.on('request', (outgoing) => {
    if (outgoing.url().endsWith('/adjustments')) writes++;
  });
  await page.locator('#inventory-delta').fill('-6');
  await page.locator('#inventory-reason').fill('Below reserved must not be sent');
  await page.getByRole('button', { name: 'Ghi nhận điều chỉnh', exact: true }).click();
  await expect(page.locator('.editor-error')).toContainText('Tồn sau điều chỉnh phải từ số đã giữ');
  expect(writes).toBe(0);
  expect(await balance()).toMatchObject({ onHand: 7, reserved: 2 });
  await page.locator('#inventory-delta').fill('-5');
  await page.locator('#inventory-reason').fill('Keep reserved stock');
  const reduced = page.waitForResponse((response) => response.url().endsWith('/adjustments'));
  await page.getByRole('button', { name: 'Ghi nhận điều chỉnh', exact: true }).click();
  expect((await reduced).status()).toBe(200);
  await expect(page.getByRole('cell', { name: 'Keep reserved stock', exact: true })).toBeVisible();
  expect(await balance()).toMatchObject({ onHand: 2, reserved: 2, available: 0 });
  await page.reload();
  await open();
  await expect(page.getByRole('cell', { name: 'Keep reserved stock', exact: true })).toBeVisible();
});

for (const shared of [false, true]) {
  test(`live ${shared ? 'Shared' : 'Unique'} stock: UI content write, availability and explicit reveal persist`, async ({
    page,
    live,
    liveApi,
  }) => {
    test.setTimeout(90_000);
    const { product, key } = await prepareProduct(liveApi, shared ? 3 : 2);
    const variant = product.variants[0]!;
    const content = `Synthetic ${shared ? 'shared' : 'unique'} secret ${key}`;
    const rows = async () =>
      body<CatalogPage<DigitalStock>>(
        await liveApi.get(`/api/digital-inventory/variants/${variant.id}`),
      );
    await signIn(page, live, `/admin/collections/products/${product.id}`);
    const open = async () =>
      page
        .locator('.wf-single-variant')
        .getByRole('button', { name: 'Quản lý nội dung số', exact: true })
        .click();
    await open();
    if (!shared) await page.locator('#digital-reference').fill(`KEY_${key}`);
    await page.locator('#digital-content').fill(content);
    const saved = page.waitForResponse(
      (response) =>
        response
          .url()
          .endsWith(
            `/api/digital-inventory/variants/${variant.id}/${shared ? 'shared-content' : 'items'}`,
          ) && response.request().method() === (shared ? 'PUT' : 'POST'),
    );
    await page
      .getByRole('button', {
        name: shared ? 'Lưu nội dung dùng chung' : 'Nhập nội dung riêng',
        exact: true,
      })
      .click();
    const accepted = await saved;
    expect(accepted.status()).toBe(200);
    await expect(page.locator('.product-commerce-editor')).toHaveCount(0);
    const first = await rows();
    expect(first.items).toHaveLength(1);
    expect(first.items[0]!.state).toBe(1);
    expect(JSON.stringify(first)).not.toContain(content);
    if (!shared) {
      const replay = await liveApi.post(`/api/digital-inventory/variants/${variant.id}/items`, {
        data: accepted.request().postDataJSON(),
      });
      expect(replay.status()).toBe(409);
      expect((await rows()).items).toHaveLength(1);
    }
    await open();
    await expect(page.locator('.product-secret')).toHaveCount(0);
    await page.getByRole('button', { name: 'Xem nội dung', exact: true }).click();
    await expect(page.locator('.product-secret')).toHaveText(content);
    const hidden = page.waitForResponse((response) => response.url().endsWith('/availability'));
    await page.getByRole('button', { name: 'Ngừng cung cấp', exact: true }).click();
    expect((await hidden).status()).toBe(200);
    await expect(page.locator('.product-secret')).toHaveCount(0);
    expect((await rows()).items[0]!.state).toBe(2);
    await open();
    const enabled = page.waitForResponse((response) => response.url().endsWith('/availability'));
    await page.getByRole('button', { name: 'Cho phép cung cấp', exact: true }).click();
    expect((await enabled).status()).toBe(200);
    expect((await rows()).items[0]!.state).toBe(1);
    await page.reload();
    await open();
    await expect(page.locator('.product-secret')).toHaveCount(0);
    await page.getByRole('button', { name: 'Xem nội dung', exact: true }).click();
    await expect(page.locator('.product-secret')).toHaveText(content);
    const storage = await page.evaluate(() =>
      JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]),
    );
    expect(storage).not.toContain(content);
  });
}
