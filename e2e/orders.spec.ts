import { test, expect, ready } from './helpers/catalog-api';
import { installOrdersApi, ORDER_ID, SECOND_ORDER_ID, SHIPPING_GRANTS } from './helpers/orders-api';

test('shipping: partial dispatch, delivery, preserved draft and COD status', async ({
  page,
  context,
  catalog,
}, testInfo) => {
  test.setTimeout(60_000);
  catalog.setPermissions(SHIPPING_GRANTS);
  const api = await installOrdersApi(context);
  await ready(page, `/admin/orders/${ORDER_ID}`);
  await page.getByRole('button', { name: 'Tạo lần giao', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Tạo lần giao hàng' });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toHaveClass(/p-dialog-enter-active/u);
  await dialog
    .getByLabel('Hãng vận chuyển *')
    .fill('Đơn vị vận chuyển có tên dài để kiểm tra tablet');
  await dialog.getByLabel('Mã vận chuyển *').fill('TRACK-PARTIAL-001');
  await dialog.getByLabel('Số lượng giao: Túi vải phiên bản có tên dài').fill('1');
  await dialog.getByRole('button', { name: 'Tạo đợt giao hàng', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.shipment-card')).toHaveCount(1);
  expect(api.shipments[0]?.items).toEqual([{ orderItemId: 'line-a', quantity: 1 }]);
  await page.getByRole('button', { name: 'Tạo lần giao', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toHaveClass(/p-dialog-enter-active/u);
  await expect(dialog.getByLabel('Số lượng giao: Túi vải phiên bản có tên dài')).toHaveAttribute(
    'max',
    '1',
  );
  await dialog.getByLabel('Hãng vận chuyển *').fill('Bản nháp tiếp theo');
  await dialog.getByLabel('Mã vận chuyển *').fill('DRAFT-002');
  await expect(dialog.getByLabel('Hãng vận chuyển *')).toHaveValue('Bản nháp tiếp theo');
  await expect(dialog.getByLabel('Mã vận chuyển *')).toHaveValue('DRAFT-002');
  await dialog.getByLabel('Số lượng giao: Sổ tay').fill('1');
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận đã giao', exact: true }).click();
  const delivery = page.getByRole('dialog', { name: 'Xác nhận giao thành công' });
  await expect(delivery).toContainText('không tự xác nhận khoản thu COD');
  await delivery.getByRole('button', { name: 'Xác nhận đã giao', exact: true }).click();
  await expect(delivery).not.toBeVisible();
  await expect(page.locator('.shipment-card')).toContainText('Đã giao');
  await expect(page.locator('.order-inspector')).toContainText('Chưa thanh toán');
  await page.getByRole('button', { name: 'Tạo lần giao', exact: true }).click();
  await expect(dialog.getByLabel('Hãng vận chuyển *')).toHaveValue('Bản nháp tiếp theo');
  await expect(dialog.getByLabel('Số lượng giao: Sổ tay')).toHaveValue('1');
  await page.screenshot({ path: testInfo.outputPath('shipping-partial-draft.png') });
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('link', { name: 'Quay lại đơn hàng', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Rời khỏi đơn hàng?' })).toBeVisible();
  await page.getByRole('button', { name: 'Ở lại', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ORDER_ID}$`));
  await page.getByRole('link', { name: 'Quay lại đơn hàng', exact: true }).click();
  await page.getByRole('button', { name: 'Bỏ thay đổi', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/orders$/u);
});

test('shipping: conflict removes consumed selections and permits corrected new operation', async ({
  page,
  context,
  catalog,
}) => {
  test.setTimeout(60_000);
  catalog.setPermissions(SHIPPING_GRANTS);
  const api = await installOrdersApi(context);
  api.conflictNextDispatch();
  await ready(page, `/admin/orders/${ORDER_ID}`);
  await page.getByRole('button', { name: 'Tạo lần giao', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Tạo lần giao hàng' });
  const carrierField = dialog.getByLabel('Hãng vận chuyển *');
  const trackingField = dialog.getByLabel('Mã vận chuyển *');
  await carrierField.fill('Hãng A');
  await trackingField.fill('TRACK-CONFLICT');
  await expect(carrierField).toHaveValue('Hãng A');
  await expect(trackingField).toHaveValue('TRACK-CONFLICT');
  await dialog.getByLabel('Số lượng giao: Túi vải phiên bản có tên dài').fill('2');
  await dialog.getByLabel('Số lượng giao: Sổ tay').fill('1');
  await dialog.getByRole('button', { name: 'Tạo đợt giao hàng', exact: true }).click();
  await expect(dialog).toContainText(/bỏ khỏi lựa chọn|Dữ liệu đã được tải lại/u);
  await expect(dialog.getByLabel('Số lượng giao: Túi vải phiên bản có tên dài')).toHaveCount(0);
  await expect(dialog.getByLabel('Số lượng giao: Sổ tay')).toHaveValue('1');
  await expect(
    dialog.getByRole('button', { name: 'Tạo đợt giao hàng', exact: true }),
  ).toBeEnabled();
  expect(api.writes).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Tạo đợt giao hàng', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(api.writes).toHaveLength(2);
  expect(api.writes[1]?.body.operationId).not.toBe(api.writes[0]?.body.operationId);
  expect(api.shipments).toHaveLength(2);
});

test('shipping: lost dispatch response freezes payload and retries one operation', async ({
  page,
  context,
  catalog,
}) => {
  test.setTimeout(60_000);
  catalog.setPermissions(SHIPPING_GRANTS);
  const api = await installOrdersApi(context);
  api.loseNextDispatchResponse();
  await ready(page, `/admin/orders/${ORDER_ID}`);
  await page.getByRole('button', { name: 'Tạo lần giao', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Tạo lần giao hàng' });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toHaveClass(/p-dialog-enter-active/u);
  await dialog.getByLabel('Hãng vận chuyển *').fill('Hãng A');
  await dialog.getByLabel('Mã vận chuyển *').fill('LOST-001');
  await expect(dialog.getByLabel('Hãng vận chuyển *')).toHaveValue('Hãng A');
  await expect(dialog.getByLabel('Mã vận chuyển *')).toHaveValue('LOST-001');
  await dialog.getByLabel('Số lượng giao: Túi vải phiên bản có tên dài').fill('2');
  await dialog.getByRole('button', { name: 'Tạo đợt giao hàng', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Kiểm tra lại yêu cầu đã gửi' })).toBeEnabled();
  await expect(dialog.getByLabel('Hãng vận chuyển *')).toBeDisabled();
  await expect(dialog.getByLabel('Mã vận chuyển *')).toBeDisabled();
  expect(api.writes).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Kiểm tra lại yêu cầu đã gửi' }).click();
  await expect(dialog).not.toBeVisible();
  expect(api.writes[1]?.body).toEqual(api.writes[0]?.body);
  expect(api.shipments).toHaveLength(1);
});

test('shipping: lost delivery response can be confirmed without double delivery', async ({
  page,
  context,
  catalog,
}) => {
  test.setTimeout(60_000);
  catalog.setPermissions(SHIPPING_GRANTS);
  const api = await installOrdersApi(context);
  api.seedShipment();
  api.loseNextDeliveryResponse();
  await ready(page, `/admin/orders/${ORDER_ID}`);
  await page.getByRole('button', { name: 'Xác nhận đã giao', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Xác nhận giao thành công' });
  await dialog.getByRole('button', { name: 'Xác nhận đã giao', exact: true }).click();
  await expect(dialog).toContainText('đang chờ kiểm tra kết quả');
  await expect(dialog.getByRole('button', { name: 'Xác nhận đã giao', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Xác nhận đã giao', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(api.writes[1]?.body).toEqual(api.writes[0]?.body);
  expect(api.shipments[0]?.status).toBe(2);
});

test('shipping: view-only permission hides mutations', async ({ page, context, catalog }) => {
  catalog.setPermissions(['Permissions.Order.View', 'Permissions.Shipping.View']);
  const api = await installOrdersApi(context);
  api.seedShipment();
  await ready(page, `/admin/orders/${ORDER_ID}`);
  await expect(page.locator('.shipment-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Tạo lần giao', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xác nhận đã giao', exact: true })).toHaveCount(0);
  expect(api.writes).toEqual([]);
});

test('shipping: no View does not request or expose shipments', async ({
  page,
  context,
  catalog,
}) => {
  catalog.setPermissions([
    'Permissions.Order.View',
    'Permissions.Shipping.Dispatch',
    'Permissions.Shipping.Deliver',
  ]);
  await installOrdersApi(context);
  const reads: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/shipments')) reads.push(r.url());
  });
  await ready(page, `/admin/orders/${ORDER_ID}`);
  await expect(page.locator('.shipping-card')).toContainText(
    'Tài khoản của bạn chưa được cấp quyền xem thông tin giao hàng.',
  );
  await expect(page.getByRole('button', { name: 'Tạo lần giao', exact: true })).toHaveCount(0);
  expect(reads).toEqual([]);
});

test('orders rail: query, Back, tablet focus and canonical membership survive commands', async ({
  page,
  context,
  catalog,
}, testInfo) => {
  catalog.setPermissions(['Permissions.Order.View', 'Permissions.Order.Cancel']);
  const api = await installOrdersApi(context, true);
  const query = '?q=ORD&status=2';
  await ready(page, `/admin/orders${query}`);
  await page.getByRole('link', { name: 'ORD-001', exact: true }).click();
  await expect(page).toHaveURL(`/admin/orders/${ORDER_ID}${query}`);
  const tablet = testInfo.project.name.startsWith('tablet');
  const toggle = page.getByRole('button', { name: 'Danh sách đơn hàng', exact: true });
  if (tablet) {
    await toggle.click();
    await expect(page.locator('#order-items')).toHaveAttribute('role', 'dialog');
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await toggle.click();
  }
  const rail = page.getByRole('navigation', { name: 'Đơn hàng trong bộ lọc', exact: true });
  await rail.getByRole('link').filter({ hasText: 'ORD-002' }).click();
  await expect(page).toHaveURL(`/admin/orders/${SECOND_ORDER_ID}${query}`);
  await page.getByRole('link', { name: 'Quay lại đơn hàng', exact: true }).click();
  await expect(page).toHaveURL(`/admin/orders${query}`);
  await page.goBack();
  await expect(page).toHaveURL(`/admin/orders/${SECOND_ORDER_ID}${query}`);
  await page.getByRole('button', { name: 'Hủy đơn', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Hủy đơn hàng', exact: true })
    .getByRole('button', { name: 'Xác nhận hủy', exact: true })
    .click();
  if (tablet) await toggle.click();
  await expect(rail.getByRole('link').filter({ hasText: 'ORD-002' })).toHaveCount(0);
  await expect(rail.getByRole('link').filter({ hasText: 'ORD-001' })).toHaveCount(1);
  expect(api.writes).toHaveLength(1);
  await expect(page).toHaveURL(`/admin/orders/${SECOND_ORDER_ID}${query}`);
});
