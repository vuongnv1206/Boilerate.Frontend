import { expect, test, ready, FIRST_PRODUCT_ID } from './helpers/catalog-api';

test('list: API search, selection, pagination and theme', async ({ page, catalog }, testInfo) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
  });
  await ready(page);
  const expectedTheme = testInfo.project.name.endsWith('dark') ? 'dark' : 'light';
  await expect(page.locator('html')).toHaveAttribute('data-theme', expectedTheme);
  await expect(page.getByRole('heading', { name: 'Sản phẩm', exact: true })).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Tìm sản phẩm' });
  await search.fill('khong-co-noi-dung-nay');
  await expect(page.getByRole('heading', { name: 'Không có sản phẩm' })).toBeVisible();
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  await expect(page.locator('.content-table tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect(page.locator('.content-table tbody tr')).toHaveCount(4);
  await page.getByRole('button', { name: 'Trang trước', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Chọn tất cả trên trang', exact: true }).check();
  await expect(page.locator('.selection-toolbar')).toContainText('10');
  await page.getByRole('button', { name: 'Bỏ chọn tất cả', exact: true }).click();
  await expect(page.locator('.selection-toolbar')).toHaveCount(0);
  expect(apiRequests.some((url) => url.endsWith('/products/search'))).toBe(true);
  expect(
    catalog.requests
      .filter((request) => request.path === 'products/search')
      .every((request) => request.authorization === 'Bearer browser-test-access-token'),
  ).toBe(true);
  await expect(page).toHaveScreenshot('list.png');
});

test('layout: resize or mobile modal, theme persistence and normal motion', async ({
  page,
}, testInfo) => {
  await ready(page);
  const toggle = page.getByRole('button', { name: 'Đóng hoặc mở bảng điều hướng', exact: true });
  if (testInfo.project.name.startsWith('mobile')) {
    await toggle.click();
    const panel = page.getByRole('dialog', { name: 'Bảng điều hướng nội dung', exact: true });
    await expect(panel).toBeVisible();
    await expect(page.locator('main')).toHaveAttribute('inert', '');
    await expect
      .poll(() => panel.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await expect(page.locator('main')).not.toHaveAttribute('inert');
  } else {
    const separator = page.getByRole('separator');
    await separator.focus();
    await page.keyboard.press('End');
    await expect(separator).toHaveAttribute('aria-valuenow', '320');
    await page.reload();
    await expect(page.locator('.workspace')).toBeVisible();
    await expect(separator).toHaveAttribute('aria-valuenow', '320');
    await page.getByRole('button', { name: 'Thu gọn bảng điều hướng', exact: true }).click();
    await expect(page.locator('.workspace')).toHaveClass(/sidebar-collapsed/);
    await toggle.click();
  }
  const next = testInfo.project.name.endsWith('dark') ? 'light' : 'dark';
  await page.getByTestId(`theme-${next}`).click();
  await page.reload();
  await expect(page.locator('.workspace')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', next);
  const motion = await page.evaluate(() => ({
    reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
    duration: (() => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--motion-slow')
        .trim();
      return parseFloat(value) * (value.endsWith('ms') ? 1 : 1000);
    })(),
  }));
  expect(motion).toEqual({ reduce: false, duration: 240 });
});

test('editor: validation, dirty guard, API save and conflict', async ({ page, catalog }) => {
  await ready(page, `/admin/collections/products/${FIRST_PRODUCT_ID}`);
  const name = page.locator('#product-name');
  const original = await name.inputValue();
  await name.fill('   ');
  await name.blur();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await name.fill(`${original} — chỉnh sửa kiểm thử`);
  await page
    .locator('.editor-breadcrumb')
    .getByRole('link', { name: 'Sản phẩm', exact: true })
    .click();
  const guard = page.getByRole('dialog');
  await expect(guard).toBeVisible();
  await guard.getByRole('button', { name: 'Ở lại', exact: true }).click();
  await expect(name).toHaveValue(`${original} — chỉnh sửa kiểm thử`);
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.locator('.editor-notice')).toContainText('Đã lưu sản phẩm.');
  expect(catalog.products[0]?.name).toBe(`${original} — chỉnh sửa kiểm thử`);
  await name.blur();
  await expect(page).toHaveScreenshot('editor.png');
  await page.reload();
  await expect(page.locator('.workspace')).toBeVisible();
  await expect(name).toHaveValue(`${original} — chỉnh sửa kiểm thử`);
  catalog.rejectNextProductSave();
  await name.fill('Bản đang sửa được giữ khi có lỗi');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.locator('.editor-error')).toBeVisible();
  await expect(name).toHaveValue('Bản đang sửa được giữ khi có lỗi');
  await expect(page.locator('.editor-save-status')).toContainText('Có thay đổi chưa lưu');
});

test('categories and product types have separate create and edit screens', async ({
  page,
  catalog,
}) => {
  await ready(page, '/admin/collections/categories');
  await page.getByRole('link', { name: 'Thêm danh mục', exact: true }).click();
  await page.locator('#category-name').fill('Danh mục thử');
  await page.locator('#category-slug').fill('danh-muc-thu');
  await page.getByRole('button', { name: 'Lưu danh mục', exact: true }).click();
  await expect(page).toHaveURL(/\/categories\/[^/]+$/u);
  await expect(page.locator('.editor-save-status')).toContainText('Đã lưu');
  expect(catalog.categories.some((item) => item.slug === 'danh-muc-thu')).toBe(true);
  await page.locator('#category-name').fill('Danh mục đã sửa');
  await page.getByRole('button', { name: 'Lưu danh mục', exact: true }).click();
  await expect(page.locator('.editor-save-status')).toContainText('Đã lưu');
  expect(catalog.categories.find((item) => item.slug === 'danh-muc-thu')?.name).toBe(
    'Danh mục đã sửa',
  );
  await page
    .locator('.collection-nav')
    .getByRole('link', { name: 'Loại sản phẩm', exact: true })
    .click();
  await page.getByRole('link', { name: 'Thêm loại sản phẩm', exact: true }).click();
  await page.locator('#product-type-code').fill('BROWSER-TEST');
  await page.locator('#product-type-name').fill('Loại sản phẩm thử');
  await page.getByRole('button', { name: 'Lưu loại sản phẩm', exact: true }).click();
  await expect(page.locator('.editor-save-status')).toContainText('Đã lưu');
  await expect(page).toHaveURL(/\/product-types\/[^/]+$/u);
  await page.locator('#product-type-name').fill('Loại đã sửa');
  await page.getByRole('button', { name: 'Lưu loại sản phẩm', exact: true }).click();
  await expect(page.locator('.editor-save-status')).toContainText('Đã lưu');
  expect(catalog.productTypes.find((item) => item.code === 'BROWSER-TEST')?.name).toBe(
    'Loại đã sửa',
  );
});

test('gallery: select, datepicker, dialog, drawer, tooltip and toast', async ({ page }) => {
  await ready(page, '/admin/controls');
  await page.locator('#gallery-category').click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#gallery-date').click();
  await expect(page.locator('.p-datepicker-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Phản hồi & lớp phủ', exact: true }).click();
  const dialogTrigger = page.getByTestId('gallery-dialog-trigger');
  await dialogTrigger.click();
  const dialog = page.getByRole('dialog', { name: 'Lưu bản xem thử?', exact: true });
  await expect(dialog).toBeVisible();
  const surface = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--surface-0').trim(),
  );
  await expect(dialog).toHaveCSS(
    'background-color',
    surface === '#242426' ? 'rgb(36, 36, 38)' : 'rgb(255, 255, 255)',
  );
  // Focus and automatic scrolling of the previous tab can differ on CI.
  // The modal scene uses an explicit background position in every viewport.
  await page.locator('app-control-gallery').evaluate((element) => element.scrollTo(0, 0));
  await expect
    .poll(() => page.locator('app-control-gallery').evaluate((element) => element.scrollTop))
    .toBe(0);
  await expect(page).toHaveScreenshot('dialog.png');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(dialogTrigger).toBeFocused();
  const drawerTrigger = page.getByTestId('gallery-drawer-trigger');
  await drawerTrigger.click();
  await expect(page.getByRole('dialog', { name: 'Tùy chọn hiển thị', exact: true })).toBeVisible();
  await expect(page.locator('#gallery-drawer-name')).toBeFocused();
  await page.locator('app-control-gallery').evaluate((element) => element.scrollTo(0, 0));
  await expect
    .poll(() => page.locator('app-control-gallery').evaluate((element) => element.scrollTop))
    .toBe(0);
  await expect(page).toHaveScreenshot('drawer.png');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'Tùy chọn hiển thị', exact: true }),
  ).not.toBeVisible();
  await expect(drawerTrigger).toBeFocused();
  const tooltipTrigger = page.getByRole('button', {
    name: 'Thông tin về bộ giao diện',
    exact: true,
  });
  await tooltipTrigger.scrollIntoViewIfNeeded();
  await tooltipTrigger.focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.getByTestId('gallery-toast-trigger').click();
  await expect(page.locator('.p-toast-message')).toBeVisible();
});
