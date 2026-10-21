import { expect, FIRST_PRODUCT_ID, ready, test } from './helpers/catalog-api';

const permissions = [
  'Product.View',
  'Product.Create',
  'Product.Update',
  'Product.Publish',
  'Price.Update',
  'Category.View',
  'ProductType.View',
  'Inventory.View',
  'Inventory.Adjust',
  'DigitalInventory.View',
  'DigitalInventory.Import',
  'DigitalInventory.Update',
  'DigitalInventory.Reveal',
].map((permission) => `Permissions.${permission}`);

test('creates multiple option combinations with individual SKU and price drafts', async ({
  page,
  catalog,
}) => {
  catalog.setPermissions(permissions);
  await ready(page, '/admin/collections/products/new');
  await page.locator('#product-name').fill('Áo sơ mi vận hành');
  await page.locator('#product-sku').fill('SHIRT');
  await page.locator('#product-price').fill('100000');
  await page.getByRole('button', { name: 'Thêm lựa chọn', exact: true }).click();
  await page.locator('#option-code-0').fill('COLOR');
  await page.locator('#option-name-0').fill('Màu sắc');
  await page.locator('#value-code-0-0').fill('RED');
  await page.locator('#value-label-0-0').fill('Đỏ');
  await page.getByRole('button', { name: 'Thêm giá trị', exact: true }).click();
  await page.locator('#value-code-0-1').fill('BLUE');
  await page.locator('#value-label-0-1').fill('Xanh');
  await page.getByRole('button', { name: 'Tạo / cập nhật tổ hợp SKU', exact: true }).click();
  await page.getByRole('button', { name: 'Sửa SKU SHIRT-BLUE', exact: true }).click();
  await page.locator('#variant-price').fill('120000');
  await page.getByRole('button', { name: 'Áp dụng vào bản chỉnh sửa', exact: true }).click();
  await page.getByRole('button', { name: 'Sửa SKU SHIRT-RED', exact: true }).click();
  await page.locator('#variant-sku').fill('CUSTOM-RED');
  await page.getByRole('button', { name: 'Áp dụng vào bản chỉnh sửa', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo / cập nhật tổ hợp SKU', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sửa SKU CUSTOM-RED', exact: true })).toBeVisible();
  await expect(page.locator('.catalog-variant-table')).toContainText('120.000');
  expect(
    catalog.requests.some((request) => request.path === 'products' && request.method === 'POST'),
  ).toBe(false);
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect
    .poll(
      () =>
        catalog.requests.filter(
          (request) => request.path === 'products' && request.method === 'POST',
        ).length,
    )
    .toBe(1);
  const request = catalog.requests.find(
    (request) => request.path === 'products' && request.method === 'POST',
  );
  expect(request?.body).toMatchObject({
    options: [
      {
        code: 'COLOR',
        name: 'Màu sắc',
        values: [
          { code: 'RED', label: 'Đỏ' },
          { code: 'BLUE', label: 'Xanh' },
        ],
      },
    ],
    variants: [
      { sku: 'CUSTOM-RED', price: 100000, options: { COLOR: 'RED' } },
      { sku: 'SHIRT-BLUE', price: 120000, options: { COLOR: 'BLUE' } },
    ],
  });
});

test('keeps a conflicted catalog draft, reloads canonical version and saves it explicitly', async ({
  page,
  catalog,
}, testInfo) => {
  catalog.setPermissions(permissions);
  let attempts = 0;
  const product = catalog.products.find((entry) => entry.id === FIRST_PRODUCT_ID);
  if (!product) throw new Error('Fixture product missing');
  await page.route(/\/api\/products\/[^/]+\/editor$/u, async (route) => {
    const request = route.request().postDataJSON() as {
      version: string;
      variantEdits: { price: number }[];
    };
    attempts++;
    if (attempts === 1) {
      product.version = 'changed-elsewhere';
      await route.fulfill({ status: 409, json: { status: 409, detail: 'Version changed' } });
      return;
    }
    expect(request.version).toBe('changed-elsewhere');
    product.version = 'saved-price';
    const variant = product.variants[0];
    if (variant) variant.price = request.variantEdits[0]?.price ?? null;
    await route.fulfill({ json: product });
  });
  await ready(page, `/admin/collections/products/${FIRST_PRODUCT_ID}`);
  const sku = product.variants[0]?.sku ?? '';
  await page.getByRole('button', { name: `Sửa SKU ${sku}`, exact: true }).click();
  await page.locator('#variant-price').fill('750000');
  await page.getByRole('button', { name: 'Áp dụng vào bản chỉnh sửa', exact: true }).click();
  expect(attempts).toBe(0);
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Dữ liệu đã thay đổi');
  await expect(page.locator('.catalog-variant-table')).toContainText('750.000');
  await page.getByRole('button', { name: 'Tải bản mới, giữ nội dung nhập', exact: true }).click();
  await expect(page.locator('.editor-notice')).toContainText('Đã tải phiên bản mới');
  await expect(page.locator('.catalog-variant-table')).toContainText('750.000');
  await page.screenshot({ path: testInfo.outputPath('sku-price-editor.png') });
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect.poll(() => product.variants[0]?.price).toBe(750000);
  expect(attempts).toBe(2);
});

test('replays the immutable stock adjustment after response loss without duplicating quantity', async ({
  page,
  catalog,
}) => {
  catalog.setPermissions(permissions);
  const product = catalog.products.find((entry) => entry.id === FIRST_PRODUCT_ID);
  if (!product) throw new Error('Fixture product missing');
  const balance = {
    id: 'balance-1',
    variantId: product.variants[0]?.id ?? '',
    locationId: 'main',
    onHand: 10,
    reserved: 3,
    available: 7,
    version: 'iv1',
  };
  let saved: Record<string, unknown> | null = null;
  let adjustmentCount = 0;
  let movement: Record<string, unknown> | null = null;
  await page.route(/\/api\/inventory(?:\?|$)/u, async (route) => {
    expect(new URL(route.request().url()).searchParams.get('productId')).toBe(FIRST_PRODUCT_ID);
    await route.fulfill({ json: { items: [balance], total: 1, pageNumber: 1, pageSize: 100 } });
  });
  await page.route(/\/api\/inventory\/balance-1\/movements/u, async (route) => {
    await route.fulfill({
      json: {
        items: movement ? [movement] : [],
        total: movement ? 1 : 0,
        pageNumber: 1,
        pageSize: 20,
      },
    });
  });
  await page.route(/\/api\/inventory\/balance-1\/adjustments/u, async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    adjustmentCount++;
    if (!saved) {
      saved = body;
      balance.onHand = 12;
      balance.available = 9;
      balance.version = 'iv2';
      movement = {
        ...body,
        id: 'movement-1',
        quantityAfter: 12,
        actorId: 'actor-1',
        createdAt: '2026-10-21T00:00:00Z',
      };
      await route.abort('failed');
      return;
    }
    expect(body).toEqual(saved);
    await route.fulfill({ json: movement });
  });
  await ready(page, `/admin/collections/products/${FIRST_PRODUCT_ID}`);
  await page
    .getByRole('button', { name: `Tồn kho ${product.variants[0]?.sku}`, exact: true })
    .click();
  await page.locator('#inventory-delta').fill('2');
  await page.locator('#inventory-reason').fill('Nhập kho đợt mới');
  await page.getByRole('button', { name: 'Ghi nhận điều chỉnh', exact: true }).click();
  await expect(page.locator('#inventory-delta')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Đóng trình sửa', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Gửi lại đúng yêu cầu cũ', exact: true }).click();
  await expect(page.locator('#inventory-delta')).toHaveValue('');
  await expect(page.getByRole('cell', { name: 'Nhập kho đợt mới', exact: true })).toBeVisible();
  expect(adjustmentCount).toBe(2);
  expect(balance.onHand).toBe(12);
});

test('keeps existing prices read only without Price.Update and creates a draft without a price', async ({
  page,
  catalog,
}) => {
  catalog.setPermissions(
    permissions.filter((permission) => permission !== 'Permissions.Price.Update'),
  );
  await ready(page, '/admin/collections/products/new');
  await expect(page.locator('#product-price')).toBeDisabled();
  await page.locator('#product-name').fill('Sản phẩm chưa đặt giá');
  await page.locator('#product-sku').fill('UNPRICED');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect
    .poll(() =>
      catalog.requests.some((request) => request.path === 'products' && request.method === 'POST'),
    )
    .toBe(true);
  expect(
    catalog.requests.find((request) => request.path === 'products' && request.method === 'POST')
      ?.body,
  ).toMatchObject({
    variants: [{ sku: 'UNPRICED', price: null, compareAtPrice: null, options: {} }],
  });
});

test('adds an option value and missing SKU, switches default and deactivates the previous default', async ({
  page,
  catalog,
}) => {
  catalog.setPermissions(permissions);
  const product = catalog.products.find((entry) => entry.id === FIRST_PRODUCT_ID);
  if (!product) throw new Error('Fixture product missing');
  const option = {
    id: 'color',
    code: 'COLOR',
    name: 'Màu sắc',
    sortOrder: 0,
    values: [{ id: 'red', code: 'RED', label: 'Đỏ', sortOrder: 0 }],
  };
  product.options = [option];
  const first = product.variants[0];
  if (!first) throw new Error('Fixture SKU missing');
  first.selections = [{ optionId: 'color', optionValueId: 'red' }];
  await ready(page, `/admin/collections/products/${FIRST_PRODUCT_ID}`);
  await page.getByRole('button', { name: 'Thêm giá trị', exact: true }).click();
  await page.locator('#value-code-0-1').fill('BLUE');
  await page.locator('#value-label-0-1').fill('Xanh');
  await page.getByRole('button', { name: 'Tạo / cập nhật tổ hợp SKU', exact: true }).click();
  await page.getByRole('button', { name: `Sửa SKU ${first.sku}-BLUE`, exact: true }).click();
  await page.locator('#variant-sku').fill('SHIRT-BLUE');
  await page.locator('#variant-price').fill('200000');
  await page.getByRole('button', { name: 'Áp dụng vào bản chỉnh sửa', exact: true }).click();
  await page.getByRole('button', { name: 'Đặt mặc định SHIRT-BLUE', exact: true }).click();
  await page.getByRole('button', { name: `Sửa SKU ${first.sku}`, exact: true }).click();
  await page.getByLabel('Đang bán', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Áp dụng vào bản chỉnh sửa', exact: true }).click();
  expect(product.variants.length).toBe(1);
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect
    .poll(
      () =>
        catalog.products
          .find((entry) => entry.id === FIRST_PRODUCT_ID)
          ?.variants.find((entry) => entry.sku === 'SHIRT-BLUE')?.isDefault,
    )
    .toBe(true);
  await expect
    .poll(
      () =>
        catalog.products
          .find((entry) => entry.id === FIRST_PRODUCT_ID)
          ?.variants.find((entry) => entry.id === first.id)?.isActive,
    )
    .toBe(false);
  expect(
    catalog.requests.filter((request) => request.path === `products/${FIRST_PRODUCT_ID}/editor`),
  ).toHaveLength(1);
  expect(
    catalog.requests.some((request) =>
      /\/(variants|options|default-variant)(?:\/|$)/u.test(request.path),
    ),
  ).toBe(false);
});

for (const shared of [false, true])
  test(`operates ${shared ? 'Shared' : 'Unique'} digital stock and only reveals content explicitly`, async ({
    page,
    catalog,
  }) => {
    catalog.setPermissions(permissions);
    const product = catalog.products.find((entry) => entry.id === FIRST_PRODUCT_ID);
    if (!product) throw new Error('Fixture product missing');
    product.fulfillmentKind = shared ? 3 : 2;
    const variant = product.variants[0];
    if (!variant) throw new Error('Fixture SKU missing');
    let stock: Record<string, unknown> | null = null;
    let content = '';
    let reveals = 0;
    await page.route(/\/api\/digital-inventory\//u, async (route) => {
      const path = new URL(route.request().url()).pathname;
      const body = route.request().postDataJSON() as Record<string, unknown> | null;
      if (path.endsWith('/reveal')) {
        reveals++;
        await route.fulfill({ json: { id: 'digital-1', content } });
        return;
      }
      if (route.request().method() === 'GET') {
        await route.fulfill({
          json: { items: stock ? [stock] : [], total: stock ? 1 : 0, pageNumber: 1, pageSize: 20 },
        });
        return;
      }
      expect(body?.['version']).toBe(product.version);
      product.version = `digital-${Date.now()}`;
      if (path.endsWith('/availability')) {
        if (stock) stock['state'] = body?.['isAvailable'] ? 1 : 2;
        await route.fulfill({ json: stock });
        return;
      }
      if (shared) content = String(body?.['content']);
      else content = String((body?.['items'] as { content: string }[])[0]?.content);
      stock = {
        id: 'digital-1',
        productId: product.id,
        variantId: variant.id,
        fulfillmentKind: product.fulfillmentKind,
        reference: shared ? 'SHARED' : 'KEY-01',
        state: 1,
        version: 'ds1',
        productVersion: product.version,
      };
      await route.fulfill({ json: shared ? stock : [stock] });
    });
    await ready(page, `/admin/collections/products/${FIRST_PRODUCT_ID}`);
    await page.getByRole('button', { name: `Nội dung số ${variant.sku}`, exact: true }).click();
    if (!shared) await page.locator('#digital-reference').fill('KEY-01');
    await page.locator('#digital-content').fill('Nội dung bán cho khách — kiểm chứng');
    await page
      .getByRole('button', {
        name: shared ? 'Lưu nội dung dùng chung' : 'Nhập nội dung riêng',
        exact: true,
      })
      .click();
    await page.getByRole('button', { name: `Nội dung số ${variant.sku}`, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Xem nội dung', exact: true })).toBeVisible();
    expect(reveals).toBe(0);
    await expect(page.locator('.product-secret')).toHaveCount(0);
    await page.getByRole('button', { name: 'Xem nội dung', exact: true }).click();
    await expect(page.locator('.product-secret')).toHaveText(content);
    expect(reveals).toBe(1);
    await page.getByRole('button', { name: 'Ngừng cung cấp', exact: true }).click();
    await expect(page.locator('.product-secret')).toHaveCount(0);
    expect(stock?.['state']).toBe(2);
  });
