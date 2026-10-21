import { expect, test, ready, finishSignIn, FIRST_PRODUCT_ID } from './helpers/catalog-api';

test('URL state survives editor Back and browser Back, and is isolated between collections', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect(page).toHaveURL(/\?page=2$/u);
  await page.locator('.content-table tbody a').first().click();
  await expect(page).toHaveURL(/products\/[0-9a-f-]+\?page=2$/u);
  await page.locator('.catalog-back').click();
  await expect(page).toHaveURL(/products\?page=2$/u);
  await expect(page.locator('.content-table tbody tr')).toHaveCount(4);
  await page.getByRole('searchbox', { name: 'Tìm sản phẩm' }).fill('tui');
  await expect(page).toHaveURL(/\?q=tui$/u);
  await page
    .locator('.collection-nav')
    .getByRole('link', { name: 'Danh mục', exact: true })
    .click();
  await expect(page).toHaveURL(/\/categories$/u);
  await page.goBack();
  await expect(page).toHaveURL(/products\?q=tui$/u);
  await expect(page.getByRole('searchbox', { name: 'Tìm sản phẩm' })).toHaveValue('tui');
  await page.goto('/admin/collections/products?page=999');
  await expect(page).toHaveURL(/products\?page=2$/u);
  await page.goto('/admin/collections/products?page=-3&status=999&pageSize=7&unknown=x');
  await expect(page).toHaveURL(/\/products$/u);
});

test('view-only access locks the editor, hides writes and rejects direct create URLs', async ({
  page,
  catalog,
}) => {
  catalog.setPermissions(['Permissions.Category.View']);
  await page.goto('/admin');
  await finishSignIn(page);
  await expect(page).toHaveURL(/\/categories$/u);
  await expect(page.locator('.collection-nav a[href*="/collections/"]')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Thêm danh mục', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Xóa danh mục /u }).first()).toBeDisabled();
  await page.locator('.content-table tbody a').first().click();
  await expect(page.locator('#category-name')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Lưu danh mục', exact: true })).toBeDisabled();
  await page.goto('/admin/collections/categories/new');
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible();
  expect(
    catalog.requests.some(
      (r) => ['PUT', 'POST', 'DELETE'].includes(r.method) && r.path.startsWith('categories'),
    ),
  ).toBe(false);
});

test('empty grants show access denied and retain logout', async ({ page, catalog }) => {
  catalog.setPermissions([]);
  await page.goto('/admin');
  await finishSignIn(page);
  await expect(page).toHaveURL(/\/forbidden$/u);
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
});

test('field errors, unknown summary and 403 preserve draft without replaying a write', async ({
  page,
  catalog,
}) => {
  await ready(page, `/admin/collections/products/${FIRST_PRODUCT_ID}`);
  const name = page.locator('#product-name');
  await name.fill('Bản nháp cần giữ');
  catalog.failNextProductSave(400, {
    'Content.Name': ['Tên bị từ chối'],
    Other: ['Lỗi chưa gắn trường'],
  });
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.locator('#product-name-error')).toContainText('Tên bị từ chối');
  await expect(page.locator('ui-form-error-summary')).toContainText('Lỗi chưa gắn trường');
  await name.fill('Bản nháp sau lỗi quyền');
  catalog.failNextProductSave(403);
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.locator('.editor-error')).toBeVisible();
  await expect(name).toHaveValue('Bản nháp sau lỗi quyền');
  expect(
    catalog.requests.filter((r) => r.method === 'PUT' && r.path.startsWith('products/')),
  ).toHaveLength(2);
});

test('category and type query return through their editors, category delete uses its version', async ({
  page,
  catalog,
}) => {
  await ready(page, '/admin/collections/categories');
  await page.locator('#categories-search').fill('Phụ kiện');
  await page.locator('.content-table tbody a').first().click();
  await page.locator('.editor-breadcrumb a').click();
  await expect(page.locator('#categories-search')).toHaveValue('Phụ kiện');
  await page.getByRole('button', { name: 'Xóa danh mục Phụ kiện', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Xóa danh mục', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Xóa danh mục', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(catalog.categories.some((item) => item.name === 'Phụ kiện')).toBe(false);
  await page
    .locator('.collection-nav')
    .getByRole('link', { name: 'Loại sản phẩm', exact: true })
    .click();
  await expect(page).toHaveURL(/\/product-types$/u);
  await page.locator('#product-types-search').fill('Đồ dùng');
  await page.locator('.content-table tbody a').first().click();
  await page.locator('.editor-breadcrumb a').click();
  await expect(page.locator('#product-types-search')).toHaveValue('Đồ dùng');
});
