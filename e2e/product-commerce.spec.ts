import { Buffer } from 'node:buffer';
import { expect, FIRST_PRODUCT_ID, ready, test } from './helpers/catalog-api';
import {
  addOption,
  addOptionValues,
  editVariant,
  fillDefaultVariant,
} from './helpers/product-editor';

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

test('rebases category membership after a stale product without repeating saved metadata', async ({
  page,
  catalog,
}) => {
  catalog.setPermissions([...permissions, 'Permissions.Category.Update']);
  const category = catalog.categories[0]!;
  const removed = catalog.products[0]!;
  const added = catalog.products[1]!;
  const external = catalog.products[2]!;
  let membershipAttempts = 0;
  await page.route(`**/api/categories/${category.id}/products`, async (route) => {
    membershipAttempts++;
    if (membershipAttempts === 1) {
      removed.version = 'externally-edited';
      external.categoryIds.push(category.id);
      await route.fulfill({ status: 409, json: { status: 409, detail: 'Version changed' } });
      return;
    }
    await route.fallback();
  });
  await ready(page, `/admin/collections/categories/${category.id}`);
  await expect(
    page.getByRole('button', { name: `Bỏ sản phẩm ${removed.name} khỏi danh mục` }),
  ).toBeVisible();
  await page.getByRole('button', { name: `Bỏ sản phẩm ${removed.name} khỏi danh mục` }).click();
  await page.getByRole('searchbox', { name: 'Tìm sản phẩm để thêm vào danh mục' }).fill(added.name);
  await page.locator('.category-product-results button').filter({ hasText: added.name }).click();
  await page.locator('#category-name').fill('Danh mục đã sửa');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Danh mục đã lưu');
  await page.getByRole('button', { name: 'Đối chiếu liên kết' }).click();
  await expect(
    page.getByRole('button', { name: `Bỏ sản phẩm ${external.name} khỏi danh mục` }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: `Bỏ sản phẩm ${added.name} khỏi danh mục` }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: `Bỏ sản phẩm ${removed.name} khỏi danh mục` }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect.poll(() => membershipAttempts).toBe(2);
  expect(removed.categoryIds).not.toContain(category.id);
  expect(added.categoryIds).toContain(category.id);
  expect(external.categoryIds).toContain(category.id);
  expect(
    catalog.requests.filter(
      (request) => request.method === 'PUT' && request.path === `categories/${category.id}`,
    ),
  ).toHaveLength(1);
});

test('duplicates only active product type schema with fresh identities and no products', async ({
  page,
  catalog,
}) => {
  catalog.setPermissions([...permissions, 'Permissions.ProductType.Create']);
  const original = catalog.productTypes[0]!;
  original.fields = [
    {
      id: 'old-field',
      code: 'MATERIAL',
      dataType: 5,
      label: 'Chất liệu',
      helpText: null,
      isRequired: false,
      isFilterable: true,
      isActive: true,
      sortOrder: 0,
      choices: [
        { id: 'old-choice', code: 'COTTON', label: 'Cotton', isActive: true, sortOrder: 0 },
        { id: 'inactive-choice', code: 'WOOL', label: 'Len', isActive: false, sortOrder: 1 },
      ],
    },
  ];
  const oldProductCount = catalog.products.length;
  await ready(page, `/admin/collections/product-types/${original.id}?q=do`);
  await expect(page.locator('.product-type-linked-list a')).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Sao chép loại sản phẩm' }).click();
  await expect.poll(() => catalog.productTypes.length).toBe(3);
  const copy = catalog.productTypes[2]!;
  expect(copy.id).not.toBe(original.id);
  expect(copy.code).not.toBe(original.code);
  expect(copy.fields).toHaveLength(1);
  expect(copy.fields[0]!.id).not.toBe(original.fields[0]!.id);
  expect(copy.fields[0]!.code).not.toBe(original.fields[0]!.code);
  expect(copy.fields[0]!.choices).toHaveLength(1);
  expect(copy.fields[0]!.choices[0]!.id).not.toBe(original.fields[0]!.choices[0]!.id);
  expect(copy.fields[0]!.choices[0]!.code).not.toBe(original.fields[0]!.choices[0]!.code);
  expect(catalog.products).toHaveLength(oldProductCount);
  await expect(page).toHaveURL(
    new RegExp(`/admin/collections/product-types/${copy.id}\\?q=do`, 'u'),
  );
  await expect(page.getByText('Chưa có sản phẩm thuộc loại này.')).toBeVisible();
});

test('does not load related products without Product.View', async ({ page, catalog }) => {
  catalog.setPermissions(['Permissions.ProductType.View']);
  await ready(page, `/admin/collections/product-types/${catalog.productTypes[0]!.id}`);
  await expect(page.getByText('Cần quyền Product.View để xem sản phẩm liên quan.')).toBeVisible();
  expect(catalog.requests.some((request) => request.path === 'products/search')).toBe(false);
});

test('creates multiple option combinations with individual SKU and price drafts', async ({
  page,
  catalog,
}) => {
  catalog.setPermissions(permissions);
  await ready(page, '/admin/collections/products/new');
  await page.locator('#product-name').fill('Áo sơ mi vận hành');
  await addOption(page, 'Màu sắc', ['Đỏ', 'Xanh']);
  await expect(page.locator('.wf-variant-row')).toHaveCount(2);
  await editVariant(page, 'Đỏ', { sku: 'CUSTOM-RED', price: 100000 });
  await editVariant(page, 'Xanh', { sku: 'SHIRT-XANH', price: 120000 });
  await expect(page.locator('.wf-variant-row').filter({ hasText: 'CUSTOM-RED' })).toBeVisible();
  await expect(page.locator('.wf-variant-row').filter({ hasText: 'SHIRT-XANH' })).toBeVisible();
  expect(
    catalog.requests.some((request) => request.path === 'products' && request.method === 'POST'),
  ).toBe(false);
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
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
        code: 'MAU_SAC',
        name: 'Màu sắc',
        values: [
          { code: 'DO', label: 'Đỏ' },
          { code: 'XANH', label: 'Xanh' },
        ],
      },
    ],
    variants: [
      { sku: 'CUSTOM-RED', price: 100000, options: { MAU_SAC: 'DO' } },
      { sku: 'SHIRT-XANH', price: 120000, options: { MAU_SAC: 'XANH' } },
    ],
  });
});

test('creates a 2 by 2 variant matrix and edits a variant through its details', async ({
  page,
  catalog,
}) => {
  catalog.setPermissions(permissions);
  await ready(page, '/admin/collections/products/new');
  await page.locator('#product-name').fill('Áo thun ma trận thử nghiệm');
  await addOption(page, 'Màu sắc', ['Đỏ', 'Xanh']);
  await addOption(page, 'Kích cỡ', ['S', 'M']);
  await expect(page.locator('.wf-variant-row')).toHaveCount(4);
  await expect(page.locator('.wf-variant-table thead')).toContainText('Màu sắc');
  await expect(page.locator('.wf-variant-table thead')).toContainText('Kích cỡ');
  await editVariant(page, 'Xanh', { sku: 'TEE-XANH-M', price: 250000, compareAtPrice: 300000 }, 1);
  await editVariant(page, 'Đỏ', { sku: 'TEE-DO-M', price: 100000 }, 1);
  await editVariant(page, 'Đỏ', { sku: 'TEE-DO-S', price: 100000 });
  await editVariant(page, 'Xanh', { sku: 'TEE-XANH-S', price: 100000 });

  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect
    .poll(() =>
      catalog.requests.some((entry) => entry.path === 'products' && entry.method === 'POST'),
    )
    .toBe(true);
  const request = catalog.requests.find(
    (entry) => entry.path === 'products' && entry.method === 'POST',
  );
  expect(request?.body).toMatchObject({
    options: [
      { code: 'MAU_SAC', values: [{ code: 'DO' }, { code: 'XANH' }] },
      { code: 'KICH_CO', values: [{ code: 'S' }, { code: 'M' }] },
    ],
    variants: [
      { sku: 'TEE-DO-S', price: 100000 },
      { sku: 'TEE-DO-M', price: 100000 },
      { sku: 'TEE-XANH-S', price: 100000 },
      { sku: 'TEE-XANH-M', price: 250000, compareAtPrice: 300000 },
    ],
  });
});

test('adds an option axis to a saved product and keeps its original SKU identity', async ({
  page,
  catalog,
}) => {
  catalog.setPermissions(permissions);
  const product = catalog.products.find((entry) => entry.id === FIRST_PRODUCT_ID);
  const original = product?.variants[0];
  if (!product || !original) throw new Error('Fixture product or SKU missing');
  await ready(page, `/admin/collections/products/${FIRST_PRODUCT_ID}`);

  await addOption(page, 'Màu sắc', ['Đỏ', 'Xanh']);
  const addedSku = `${original.sku}-XANH`;
  await expect(page.locator('.wf-variant-row')).toHaveCount(2);
  await expect(page.locator('.wf-variant-row').nth(0)).toContainText(original.sku);
  await editVariant(page, addedSku, { price: 790000 });
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect
    .poll(() =>
      catalog.requests.some((request) => request.path === `products/${FIRST_PRODUCT_ID}/editor`),
    )
    .toBe(true);

  const request = catalog.requests.find(
    (entry) => entry.path === `products/${FIRST_PRODUCT_ID}/editor`,
  );
  expect(request?.body).toMatchObject({
    addedOptions: [
      { code: 'MAU_SAC', name: 'Màu sắc', values: [{ code: 'DO' }, { code: 'XANH' }] },
    ],
    variantEdits: [{ variantId: original.id }],
    addedVariants: [{ sku: addedSku, price: 790000, options: { MAU_SAC: 'XANH' } }],
  });
  expect(product.variants.find((variant) => variant.id === original.id)?.sku).toBe(original.sku);
  expect(product.variants.find((variant) => variant.id === original.id)?.selections).toHaveLength(
    1,
  );
  expect(product.variants).toHaveLength(2);
});

test('discarding an unsaved option axis keeps the saved variants in the editor draft', async ({
  page,
  catalog,
}) => {
  catalog.setPermissions(permissions);
  const product = catalog.products.find((entry) => entry.id === FIRST_PRODUCT_ID);
  const original = product?.variants[0];
  if (!product || !original) throw new Error('Fixture product or SKU missing');
  await ready(page, `/admin/collections/products/${FIRST_PRODUCT_ID}`);

  await addOption(page, 'Màu sắc', ['Đỏ', 'Xanh']);
  await page.locator('.wf-option-summary').filter({ hasText: 'Màu sắc' }).click();
  await page.getByRole('button', { name: 'Xóa nhóm lựa chọn', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Xóa nhóm lựa chọn');
  await page.getByRole('button', { name: 'Xóa nhóm', exact: true }).click();
  await expect(page.locator('.wf-option-summary')).toHaveCount(0);
  await expect(page.locator('.wf-single-variant')).toBeVisible();
  await expect(page.locator('.wf-single-variant input[id^="variant-sku-"]')).toHaveValue(
    original.sku,
  );
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect
    .poll(() =>
      catalog.requests.some((request) => request.path === `products/${FIRST_PRODUCT_ID}/editor`),
    )
    .toBe(true);
  const request = catalog.requests.find(
    (entry) => entry.path === `products/${FIRST_PRODUCT_ID}/editor`,
  );
  expect(request?.body).toMatchObject({
    addedOptions: [],
    variantEdits: [{ variantId: original.id }],
    addedVariants: [],
  });
  expect(product.variants).toHaveLength(1);
});

test('confirms removal of generated variants when deleting an option value or group', async ({
  page,
  catalog,
}) => {
  catalog.setPermissions(permissions);
  await ready(page, '/admin/collections/products/new');
  await page.locator('#product-name').fill('Sản phẩm thử xóa option');
  await fillDefaultVariant(page, { sku: 'REMOVE', price: 100000 });
  await addOption(page, 'Màu sắc', ['Đỏ', 'Xanh']);
  await expect(page.locator('.wf-variant-row')).toHaveCount(2);

  await page.locator('.wf-option-summary').filter({ hasText: 'Màu sắc' }).click();
  const blueChip = page.locator('.wf-option-chip').filter({ hasText: 'Xanh' });
  await blueChip.getByRole('button', { name: 'Tùy chọn Xanh', exact: true }).click();
  await blueChip.getByRole('button', { name: 'Xóa', exact: true }).click();
  await page.getByRole('button', { name: 'Xong', exact: true }).click();
  await expect(page.locator('.wf-variant-row')).toHaveCount(1);

  await page.locator('.wf-option-summary').filter({ hasText: 'Màu sắc' }).click();
  await page.getByRole('button', { name: 'Xóa nhóm lựa chọn', exact: true }).click();
  await page.getByRole('button', { name: 'Xóa nhóm', exact: true }).click();
  await expect(page.locator('.wf-option-summary')).toHaveCount(0);
  await expect(page.locator('.wf-single-variant')).toBeVisible();
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
  const firstSku = product.variants[0]?.sku;
  if (!firstSku) throw new Error('Fixture SKU missing');
  await page.locator('.wf-single-variant input[id^="variant-price-"]').fill('750000');
  expect(attempts).toBe(0);
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Dữ liệu đã thay đổi');
  await page.getByRole('button', { name: 'Tải bản mới, giữ nội dung nhập', exact: true }).click();
  await expect(page.locator('.editor-notice')).toContainText('Đã tải phiên bản mới');
  await expect(page.locator('.wf-single-variant input[id^="variant-price-"]')).toHaveValue(
    '750000',
  );
  await page.screenshot({ path: testInfo.outputPath('sku-price-editor.png') });
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect.poll(() => product.variants[0]?.price).toBe(750000);
  expect(attempts).toBe(2);
});

test('preserves edited custom fields across repeated product-type conflicts', async ({
  page,
  catalog,
}) => {
  catalog.setPermissions(permissions);
  const product = catalog.products.find((entry) => entry.id === FIRST_PRODUCT_ID);
  const type = catalog.productTypes.find((entry) => entry.id === product?.productTypeId);
  if (!product || !type) throw new Error('Catalog fixture missing');
  const editedFieldId = '10000000-0000-0000-0000-000000000101';
  const untouchedFieldId = '10000000-0000-0000-0000-000000000102';
  type.fields = [
    {
      id: editedFieldId,
      code: 'EDITOR_NOTE',
      dataType: 1,
      label: 'Ghi chú chỉnh sửa',
      helpText: null,
      isRequired: false,
      isFilterable: false,
      isActive: true,
      sortOrder: 0,
      choices: [],
    },
    {
      id: untouchedFieldId,
      code: 'CARE_NOTE',
      dataType: 1,
      label: 'Ghi chú bảo quản',
      helpText: null,
      isRequired: false,
      isFilterable: false,
      isActive: true,
      sortOrder: 1,
      choices: [],
    },
  ];
  const fieldValue = (fieldDefinitionId: string, label: string, textValue: string) => ({
    fieldDefinitionId,
    fieldType: 1,
    textValue,
    label,
    choiceLabel: null,
  });
  product.fields = [
    fieldValue(editedFieldId, 'Ghi chú chỉnh sửa', 'Giá trị cũ đã sửa'),
    fieldValue(untouchedFieldId, 'Ghi chú bảo quản', 'Giá trị cũ chưa sửa'),
  ];
  let attempts = 0;
  await page.route(/\/api\/products\/[^/]+\/editor$/u, async (route) => {
    const request = route.request().postDataJSON() as {
      productTypeVersion: string;
      content: { name: string; fields: unknown[] };
    };
    attempts++;
    if (attempts === 1 || attempts === 2) {
      if (attempts === 2) expect(request.productTypeVersion).toBe('type-version-changed');
      type.version = attempts === 1 ? 'type-version-changed' : 'type-version-after-second-conflict';
      product.version = `product-version-changed-${attempts}`;
      product.fields = [
        fieldValue(
          editedFieldId,
          'Ghi chú chỉnh sửa',
          attempts === 1 ? 'Giá trị mới từ máy chủ' : 'Giá trị mới nhất từ máy chủ',
        ),
        fieldValue(
          untouchedFieldId,
          'Ghi chú bảo quản',
          attempts === 1 ? 'Ghi chú máy chủ mới' : 'Ghi chú máy chủ mới nhất',
        ),
      ];
      await route.fulfill({ status: 409, json: { status: 409, detail: 'Product type changed' } });
      return;
    }
    expect(request.productTypeVersion).toBe('type-version-after-second-conflict');
    expect(request.content.fields).toEqual(
      expect.arrayContaining([
        { fieldDefinitionId: editedFieldId, fieldType: 1, textValue: 'Bản nháp của tôi' },
        {
          fieldDefinitionId: untouchedFieldId,
          fieldType: 1,
          textValue: 'Ghi chú máy chủ mới nhất',
        },
      ]),
    );
    product.name = request.content.name;
    product.version = 'saved-after-type-conflict';
    product.modifiedOn = new Date().toISOString();
    await route.fulfill({ json: product });
  });
  await ready(page, `/admin/collections/products/${FIRST_PRODUCT_ID}`);
  await page.locator(`#product-field-${editedFieldId}`).fill('Bản nháp của tôi');
  await page.locator('#product-name').fill('Tên giữ lại sau xung đột loại');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Dữ liệu đã thay đổi');
  await page.getByRole('button', { name: 'Tải bản mới, giữ nội dung nhập', exact: true }).click();
  await expect(page.locator('.editor-notice')).toContainText('Đã tải phiên bản mới');
  await expect(page.locator('#product-name')).toHaveValue('Tên giữ lại sau xung đột loại');
  await expect(page.locator(`#product-field-${editedFieldId}`)).toHaveValue('Bản nháp của tôi');
  await expect(page.locator(`#product-field-${untouchedFieldId}`)).toHaveValue(
    'Ghi chú máy chủ mới',
  );
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Dữ liệu đã thay đổi');
  await page.getByRole('button', { name: 'Tải bản mới, giữ nội dung nhập', exact: true }).click();
  await expect(page.locator(`#product-field-${editedFieldId}`)).toHaveValue('Bản nháp của tôi');
  await expect(page.locator(`#product-field-${untouchedFieldId}`)).toHaveValue(
    'Ghi chú máy chủ mới nhất',
  );
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect.poll(() => product.name).toBe('Tên giữ lại sau xung đột loại');
  expect(attempts).toBe(3);
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
  await expect(page.locator('.wf-single-variant input[id^="variant-price-"]')).toBeDisabled();
  await page.locator('#product-name').fill('Sản phẩm chưa đặt giá');
  await fillDefaultVariant(page, { sku: 'UNPRICED' });
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
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

test('allows create-only users to upload and save product images', async ({ page, catalog }) => {
  catalog.setPermissions([
    'Permissions.Product.View',
    'Permissions.Product.Create',
    'Permissions.Category.View',
    'Permissions.ProductType.View',
  ]);
  await ready(page, '/admin/collections/products/new');
  const fileInput = page.locator('.wf-single-variant input[type="file"]').first();
  await expect(fileInput).toBeEnabled();
  await fileInput.setInputFiles({
    name: 'catalog-cover.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.locator('.wf-media-item')).toHaveCount(1);
  await page.locator('#product-name').fill('Ảnh sản phẩm chỉ quyền tạo');
  await fillDefaultVariant(page, { sku: 'CREATE-ONLY-IMAGE' });
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect
    .poll(
      () =>
        catalog.products.find((product) => product.name === 'Ảnh sản phẩm chỉ quyền tạo')?.media,
    )
    .toHaveLength(1);
  expect(
    catalog.requests.some((request) => request.path === 'media' && request.method === 'POST'),
  ).toBe(true);
});

test('duplicates a product without copying prices when Price.Update is unavailable', async ({
  page,
  catalog,
}) => {
  catalog.setPermissions(
    permissions.filter((permission) => permission !== 'Permissions.Price.Update'),
  );
  await ready(page, `/admin/collections/products/${FIRST_PRODUCT_ID}`);
  await page.getByRole('link', { name: 'Nhân bản', exact: true }).click();
  await expect(page).toHaveURL(/duplicateFrom=/u);
  await expect(page.locator('.editor-notice')).toContainText('Giá không được sao chép');
  const variant = page.locator('.wf-single-variant');
  await expect(variant.locator('input[id^="variant-price-"]')).toBeDisabled();
  await expect(variant.locator('input[id^="variant-price-"]')).toHaveValue('');

  await page.locator('#product-name').fill('Bản sao không có giá');
  await fillDefaultVariant(page, { sku: 'COPY-NO-PRICE' });
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect
    .poll(() =>
      catalog.requests.some((request) => request.path === 'products' && request.method === 'POST'),
    )
    .toBe(true);
  expect(
    catalog.requests.find((request) => request.path === 'products' && request.method === 'POST')
      ?.body,
  ).toMatchObject({
    variants: [{ sku: 'COPY-NO-PRICE', price: null, compareAtPrice: null }],
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
  await addOptionValues(page, 'Màu sắc', ['Xanh']);
  const addedSku = `${first.sku}-XANH`;
  await expect(page.locator('.wf-variant-row')).toHaveCount(2);
  await page.locator('.wf-variant-row').filter({ hasText: addedSku }).click();
  let detail = page.locator('.wf-detail-row');
  await detail.locator('input[id^="variant-price-"]').fill('200000');
  await detail.locator('input[id^="variant-sku-"]').fill('SHIRT-BLUE');
  await detail.getByRole('button', { name: 'Đặt mặc định', exact: true }).click();
  await detail.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.locator('.wf-variant-row').filter({ hasText: first.sku }).click();
  detail = page.locator('.wf-detail-row');
  await detail.getByRole('switch', { name: /^Đang bán/ }).uncheck();
  await detail.getByRole('button', { name: 'Đóng', exact: true }).click();
  expect(product.variants.length).toBe(1);
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
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
    await page
      .locator('.wf-single-variant')
      .getByRole('button', { name: 'Quản lý nội dung số', exact: true })
      .click();
    if (!shared) await page.locator('#digital-reference').fill('KEY-01');
    await page.locator('#digital-content').fill('Nội dung bán cho khách — kiểm chứng');
    await page
      .getByRole('button', {
        name: shared ? 'Lưu nội dung dùng chung' : 'Nhập nội dung riêng',
        exact: true,
      })
      .click();
    await page
      .locator('.wf-single-variant')
      .getByRole('button', { name: 'Quản lý nội dung số', exact: true })
      .click();
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
