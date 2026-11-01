import type { BrowserContext } from '@playwright/test';
import type { StorefrontSettings } from '../src/app/models/storefront-settings.dto';
import { expect, ready, test } from './helpers/catalog-api';
import { installOrdersApi, ORDER_ID, SHIPPING_GRANTS } from './helpers/orders-api';
import { installRenewalsApi, PENDING_RENEWAL_ID, RENEWAL_GRANTS } from './helpers/renewals-api';
import { installSystemApi } from './helpers/system-api';

test('admin design: category list keeps the shared collection layout', async ({ page }) => {
  await ready(page, '/admin/collections/categories');
  await expect(page.locator('#categories-heading')).toContainText('Danh mục');
  await expect(page.locator('.content-table tbody tr').first()).toBeVisible();
  await expect(page).toHaveScreenshot('admin-categories.png');
});

test('admin design: product type editor keeps the shared form and metadata layout', async ({
  page,
  catalog,
}) => {
  const productType = catalog.productTypes[0];
  if (!productType) throw new Error('Product type fixture missing');
  await ready(page, `/admin/collections/product-types/${productType.id}`);
  await expect(page.locator('#product-type-name')).toHaveValue(productType.name);
  await expect(page).toHaveScreenshot('admin-product-type-editor.png');
});

test('admin design: order detail presents long customer and item values', async ({
  page,
  context,
  catalog,
}) => {
  catalog.setPermissions(SHIPPING_GRANTS);
  await installOrdersApi(context, true);
  await ready(page, `/admin/orders/${ORDER_ID}`);
  await expect(page.locator('.order-inspector')).toContainText('Chưa thanh toán');
  await expect(page.getByRole('button', { name: 'Tạo lần giao', exact: true })).toBeEnabled();
  await expect(page).toHaveScreenshot('admin-order-detail.png');
  const items = page.getByRole('region', { name: 'Sản phẩm trong đơn hàng' });
  const overflows = await items.evaluate((element) => element.scrollWidth > element.clientWidth);
  if (page.viewportSize()!.width === 1024) expect(overflows).toBe(true);
  if (overflows) {
    await items.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => items.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  }
});

test('admin design: renewal verification uses the shared detail and form layout', async ({
  page,
  context,
  catalog,
}) => {
  catalog.setPermissions(RENEWAL_GRANTS);
  await installRenewalsApi(context);
  await ready(page, `/admin/renewals/${PENDING_RENEWAL_ID}`);
  await expect(page.locator('.renewal-verify-form')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Lưu kết quả xác minh', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('admin-renewal-detail.png');
});

test('admin design: order detail shows the stored discount and final total', async ({
  page,
  context,
  catalog,
}) => {
  catalog.setPermissions(SHIPPING_GRANTS);
  const api = await installOrdersApi(context);
  api.order.discountCode = 'SAVE10';
  api.order.discountAmount = 30000;
  api.order.total = 270000;
  await ready(page, `/admin/orders/${ORDER_ID}`);
  const totals = page.locator('.order-totals');
  await expect(totals).toContainText('Giảm giá (SAVE10)');
  await expect(totals).toContainText('30.000');
  await expect(totals).toContainText('270.000');
});

test('admin design: role permissions keep grouped controls and action labels readable', async ({
  page,
  context,
}) => {
  await installSystemApi(context);
  await ready(page, '/admin/system/roles/editor');
  await page.getByRole('button', { name: 'Phân quyền truy cập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Màn hình và chức năng' })).toBeVisible();
  await expect(page.locator('.permission-function')).toHaveCount(3);
  await expect(page).toHaveScreenshot('admin-role-permissions.png');
});

test('admin settings: payment form keeps its draft after a failed save and retries explicitly', async ({
  page,
  context,
  catalog,
}) => {
  catalog.setPermissions(SETTINGS_GRANTS);
  const api = await installSettingsApi(context);
  await ready(page, '/admin/storefront-settings');
  const bank = page.getByRole('textbox', { name: 'Ngân hàng', exact: true });
  await expect(bank).toHaveValue('Ngân hàng thương mại của cửa hàng');
  await expect(page).toHaveScreenshot('admin-payment-settings.png');
  await bank.fill('Ngân hàng đã kiểm tra thông tin nhận tiền');
  api.failNextSave();
  const releaseSave = api.holdNextSave();
  await page.getByRole('button', { name: 'Lưu cài đặt', exact: true }).click();
  try {
    await expect(page.getByRole('button', { name: 'Đang lưu…', exact: true })).toBeDisabled();
    await expect(bank).toBeDisabled();
    await expect(page.getByLabel('Hướng dẫn chuyển khoản', { exact: true })).toBeDisabled();
    await expect(page.locator('#settings-bank-transfer')).toBeDisabled();
    await expect.poll(() => api.writes.length).toBe(1);
  } finally {
    releaseSave();
  }
  await expect(page.getByRole('alert')).toContainText('Máy chủ chưa thể xử lý yêu cầu.');
  await expect(bank).toHaveValue('Ngân hàng đã kiểm tra thông tin nhận tiền');
  await expect(bank).toBeEnabled();
  await expect(page.locator('#settings-bank-transfer')).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Lưu cài đặt', exact: true })).toBeEnabled();
  expect(api.writes).toHaveLength(1);
  await page.getByRole('button', { name: 'Lưu cài đặt', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu thông tin thanh toán.');
  expect(api.writes).toHaveLength(2);
  expect(api.writes[1]?.bankName).toBe('Ngân hàng đã kiểm tra thông tin nhận tiền');
});

test('admin settings: loading and failed reads keep recovery available', async ({
  page,
  context,
  catalog,
}) => {
  catalog.setPermissions(SETTINGS_GRANTS);
  const api = await installSettingsApi(context, { failFirstRead: true });
  await ready(page, '/admin/storefront-settings');
  await expect(page.getByRole('status')).toContainText('Đang tải');
  await expect(page.getByRole('button', { name: 'Lưu cài đặt', exact: true })).toBeDisabled();
  api.releaseFirstRead();
  await expect(page.getByRole('alert')).toContainText('Máy chủ chưa thể xử lý yêu cầu.');
  await expect(page.getByRole('button', { name: 'Thử lại', exact: true })).toBeEnabled();
  await expect(page).toHaveScreenshot('admin-payment-settings-error.png');
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Ngân hàng', exact: true })).toHaveValue(
    'Ngân hàng thương mại của cửa hàng',
  );
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(api.writes).toEqual([]);
});

test('admin settings: view-only access shows disabled fields and sends no writes', async ({
  page,
  context,
  catalog,
}) => {
  catalog.setPermissions(['Permissions.StorefrontSettings.View']);
  const api = await installSettingsApi(context);
  await ready(page, '/admin/storefront-settings');
  await expect(page.getByRole('textbox', { name: 'Ngân hàng', exact: true })).toHaveValue(
    'Ngân hàng thương mại của cửa hàng',
  );
  await expect(page.getByRole('textbox', { name: 'Ngân hàng', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Hướng dẫn chuyển khoản', { exact: true })).toBeDisabled();
  await expect(page.locator('#settings-bank-transfer')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Lưu cài đặt', exact: true })).toHaveCount(0);
  await expect(page).toHaveScreenshot('admin-payment-settings-readonly.png');
  expect(api.writes).toEqual([]);
});

const SETTINGS_GRANTS = [
  'Permissions.StorefrontSettings.View',
  'Permissions.StorefrontSettings.Update',
];

async function installSettingsApi(
  context: BrowserContext,
  options: { failFirstRead?: boolean } = {},
) {
  let settings: StorefrontSettings = {
    version: 'settings-v1',
    bankName: 'Ngân hàng thương mại của cửa hàng',
    accountNumber: '0123456789',
    accountHolder: 'NGUYEN VAN CHU CUA HANG',
    branch: 'Chi nhánh Thành phố Hồ Chí Minh',
    instructions: 'Ghi mã đơn hàng trong nội dung chuyển khoản để nhân viên đối soát chính xác.',
    bankTransferEnabled: true,
  };
  const writes: StorefrontSettings[] = [];
  let reads = 0;
  let failNext = false;
  let pendingSave: Promise<void> | undefined;
  let releaseFirstRead = () => {};
  const firstRead = new Promise<void>((resolve) => (releaseFirstRead = resolve));
  await context.route('**/api/admin/storefront-settings', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      reads++;
      if (options.failFirstRead && reads === 1) {
        await firstRead;
        return route.fulfill({ status: 503, json: { status: 503 } });
      }
      return route.fulfill({ json: settings });
    }
    if (method === 'PUT') {
      const request = route.request().postDataJSON() as StorefrontSettings;
      writes.push(request);
      const waiting = pendingSave;
      pendingSave = undefined;
      if (waiting) await waiting;
      if (failNext) {
        failNext = false;
        return route.fulfill({ status: 503, json: { status: 503 } });
      }
      settings = { ...request, version: `settings-v${writes.length + 1}` };
      return route.fulfill({ json: settings });
    }
    return route.fulfill({ status: 405 });
  });
  return {
    writes,
    releaseFirstRead,
    failNextSave: () => (failNext = true),
    holdNextSave: () => {
      let release = () => {};
      pendingSave = new Promise<void>((resolve) => (release = resolve));
      return release;
    },
  };
}
