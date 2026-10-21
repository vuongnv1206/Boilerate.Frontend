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
