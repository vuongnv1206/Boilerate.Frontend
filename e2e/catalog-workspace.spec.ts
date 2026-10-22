import { expect, ready, test } from './helpers/catalog-api';

test('catalog toolbar filters, sorts and bulk updates selected versions', async ({
  page,
  catalog,
}) => {
  await ready(page);
  const sort = page.getByRole('combobox', { name: 'Sắp xếp sản phẩm', exact: true });
  await sort.click();
  await page.getByRole('option', { name: 'Tên A → Z', exact: true }).click();
  await expect(page).toHaveURL(/sortBy=name&sortDirection=asc$/u);
  const sortedRequest = catalog.requests
    .filter((request) => request.path === 'products/search' && request.method === 'POST')
    .at(-1);
  expect(sortedRequest?.body).toMatchObject({ sortBy: 'name', sortDirection: 'asc' });

  const firstRow = page.locator('.catalog-products-table tbody tr').first();
  const firstName = await firstRow.locator('.name-cell a').innerText();
  await firstRow.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Xuất bản đã chọn', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Xuất bản sản phẩm đã chọn', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(
    page.locator('.collection-notice').filter({ hasText: 'Đã cập nhật 1 sản phẩm.' }),
  ).toBeVisible();
  expect(catalog.products.find((product) => product.name === firstName)?.status).toBe(2);
  expect(
    catalog.requests.some(
      (request) => request.path === 'products/bulk-status' && request.method === 'POST',
    ),
  ).toBe(true);
});

test('preserves catalog filters, sort and page through editor navigation and reload', async ({
  page,
  catalog,
}) => {
  const source = catalog.products[0];
  if (!source) throw new Error('Catalog fixture missing');
  for (let index = 0; index < 22; index++) {
    const copy = structuredClone(source);
    const suffix = String(index + 1).padStart(12, '0');
    copy.id = `39000000-0000-0000-0000-${suffix}`;
    copy.version = `catalog-page-${index + 1}`;
    copy.name = `Z Catalog page ${String(index + 1).padStart(2, '0')}`;
    copy.slug = `z-catalog-page-${index + 1}`;
    copy.modifiedOn = new Date(Date.UTC(2026, 9, index + 1)).toISOString();
    copy.variants = copy.variants.map((variant, variantIndex) => ({
      ...variant,
      id: `49000000-0000-0000-0000-${String(index * 10 + variantIndex + 1).padStart(12, '0')}`,
      sku: `ROUNDTRIP-${index + 1}-${variantIndex + 1}`,
    }));
    catalog.products.push(copy);
  }

  const filters = {
    page: '2',
    pageSize: '20',
    fulfillmentKind: '1',
    inStock: 'true',
    minimumPrice: '500000',
    maximumPrice: '1000000',
    sortBy: 'name',
    sortDirection: 'asc',
  };
  const query = new URLSearchParams(filters).toString();
  const searchBody = {
    pageNumber: 2,
    pageSize: 20,
    fulfillmentKind: 1,
    inStock: true,
    minimumPrice: 500000,
    maximumPrice: 1000000,
    sortBy: 'name',
    sortDirection: 'asc',
  };
  const expectQuery = () => {
    const params = Object.fromEntries(new URL(page.url()).searchParams.entries());
    expect(params).toMatchObject(filters);
  };

  await ready(page, `/admin/collections/products?${query}`);
  await expect(page.locator('.catalog-products-table tbody tr').first()).toBeVisible();
  await expect
    .poll(
      () =>
        catalog.requests
          .filter((request) => request.path === 'products/search' && request.method === 'POST')
          .at(-1)?.body,
    )
    .toMatchObject(searchBody);
  expectQuery();

  await page.locator('.catalog-products-table tbody tr').first().locator('.name-cell a').click();
  await expect(page).toHaveURL(/\/admin\/collections\/products\/[^/?]+\?/u);
  expectQuery();
  await page.locator('.catalog-back').click();
  await expect(page).toHaveURL(/\/admin\/collections\/products\?/u);
  expectQuery();

  await page.reload();
  await expect(page.locator('.catalog-products-table tbody tr').first()).toBeVisible();
  await expect
    .poll(
      () =>
        catalog.requests
          .filter((request) => request.path === 'products/search' && request.method === 'POST')
          .at(-1)?.body,
    )
    .toMatchObject(searchBody);
});

test('editor keeps the catalog rail and exposes a tablet panel', async ({ page }) => {
  await ready(page, '/admin/collections/products/30000000-0000-0000-0000-000000000001');
  const toggle = page.getByRole('button', { name: 'Danh sách sản phẩm', exact: true });
  if (await toggle.count()) {
    await toggle.click();
    const panel = page.getByRole('dialog', { name: 'Chuyển sản phẩm', exact: true });
    await expect(panel).toBeVisible();
    await expect(page.locator('.catalog-workspace-content')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
  } else {
    await expect(page.locator('.catalog-items')).toBeVisible();
  }
  await expect(page.locator('.catalog-back')).toBeVisible();
});
