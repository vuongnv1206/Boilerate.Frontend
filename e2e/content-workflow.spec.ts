import { expect, test, ready, finishSignIn } from './helpers/catalog-api';

test('product: create, publish and reopen through the API', async ({ page, catalog }) => {
  await ready(page);
  await page.getByRole('link', { name: 'Thêm sản phẩm', exact: true }).first().click();
  await expect(page).toHaveURL(/\/products\/new$/u);
  await page.locator('#product-name').fill('Sản phẩm kiểm thử');
  await page.locator('#product-sku').fill('BROWSER-TEST-001');
  await page.locator('#product-price').fill('250000');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}$/u);
  await expect(page.locator('.editor-save-status')).toHaveText('Đã lưu');
  await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
  await expect(page.locator('.editor-notice')).toContainText('Đã cập nhật trạng thái');
  const saved = catalog.products.find((product) => product.name === 'Sản phẩm kiểm thử');
  expect(saved?.status).toBe(2);
  expect(saved?.variants[0]?.price).toBe(250000);
  await page.reload();
  await finishSignIn(page);
  await expect(page.locator('#product-name')).toHaveValue('Sản phẩm kiểm thử');
  await expect(page.getByRole('button', { name: 'Về bản nháp', exact: true })).toBeVisible();
});
