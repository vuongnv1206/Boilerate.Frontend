import { expect, test } from '@playwright/test';

test('content: create and reopen a draft, preserve list filters, reset the demo on reload', async ({
  page,
}) => {
  const name = 'Nội dung kiểm thử nền Angular';
  const updatedName = `${name} đã cập nhật`;
  const query = 'kiểm thử nền Angular';
  const slug = 'noi-dung-kiem-thu-nen-angular';

  await page.goto('/admin/collections/products');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.workspace')).toBeVisible();
  await expect(page.locator('.total-count')).toHaveText('14');

  const search = page.getByRole('searchbox', { name: 'Tìm kiếm nội dung', exact: true });
  await search.fill(query);
  await page.locator('.status-select').click();
  await page.getByRole('option', { name: 'Bản nháp', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Không tìm thấy nội dung', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Thêm sản phẩm', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/items\/new\?collection=products$/);

  const itemName = page.locator('#item-name');
  const itemSlug = page.locator('#item-slug');
  await itemName.fill(name);
  await expect(itemSlug).toHaveValue(slug);
  // A valid draft saves through the page-scoped store after its debounce.
  // No explicit save or timer shortcut is used in this flow.
  await expect(page.locator('.editor-save-status')).toContainText('Đã lưu trong bản mẫu');
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lưu thay đổi', exact: true })).toBeDisabled();
  await page
    .locator('.editor-breadcrumb')
    .getByRole('link', { name: 'Sản phẩm', exact: true })
    .click();

  await expect(search).toHaveValue(query);
  await expect(page.locator('.status-select')).toContainText('Bản nháp');
  await expect(page.locator('.content-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.total-count')).toHaveText('15');
  const navigationCount = page
    .getByRole('navigation', { name: 'Bộ sưu tập', exact: true, includeHidden: true })
    .locator('a[href="/admin/collections/products"]')
    .locator('.nav-count');
  await expect(navigationCount).toHaveText('15');

  const recordLink = page.getByRole('link', { name, exact: true });
  const recordPath = await recordLink.getAttribute('href');
  expect(recordPath).toMatch(/^\/admin\/items\/demo-[\da-f-]+$/);
  if (!recordPath) throw new Error('Expected the newly saved content identity.');
  await recordLink.click();
  await expect(page).toHaveURL(new RegExp(`${recordPath}$`));
  await expect(itemName).toHaveValue(name);
  await expect(itemSlug).toHaveValue(slug);

  await itemName.fill(updatedName);
  await expect(page.locator('.editor-save-status')).toContainText('Đã lưu trong bản mẫu');
  await expect(page.getByRole('heading', { name: updatedName, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lưu thay đổi', exact: true })).toBeDisabled();
  // Existing content keeps its slug and identity when its name is edited.
  await expect(itemSlug).toHaveValue(slug);
  await page
    .locator('.editor-breadcrumb')
    .getByRole('link', { name: 'Sản phẩm', exact: true })
    .click();
  await expect(search).toHaveValue(query);
  await expect(page.locator('.status-select')).toContainText('Bản nháp');
  await expect(page.getByRole('link', { name: updatedName, exact: true })).toHaveAttribute(
    'href',
    recordPath,
  );
  await expect(page.locator('.content-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.total-count')).toHaveText('15');
  await expect(navigationCount).toHaveText('15');

  await page.reload();
  await expect(page.locator('.total-count')).toHaveText('14');
  await expect(navigationCount).toHaveText('14');
  await expect(search).toHaveValue('');
  await search.fill(query);
  await expect(
    page.getByRole('heading', { name: 'Không tìm thấy nội dung', exact: true }),
  ).toBeVisible();
});
