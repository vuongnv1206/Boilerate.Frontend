import { test, expect, ready } from './helpers/catalog-api';
import { AFTER_SALES_GRANTS, installAfterSalesApi } from './helpers/after-sales-api';
import { ORDER_ID } from './helpers/orders-api';

test('after-sales: refund conflict keeps draft and response loss replays one immutable ledger entry', async ({
  page,
  context,
  catalog,
}) => {
  catalog.setPermissions(AFTER_SALES_GRANTS);
  const api = await installAfterSalesApi(context);
  api.conflictNextRefund();
  await ready(page, `/admin/orders/${ORDER_ID}`);
  await page.getByRole('button', { name: 'Ghi nhận hoàn tiền', exact: true }).click();
  const form = page
    .locator('.after-sales-form')
    .filter({ hasText: 'Ghi nhận khoản đã hoàn thực tế' });
  await form.getByLabel('Mã chứng từ', { exact: true }).fill('REFUND-LOCAL');
  await form.getByLabel('Số tiền VND', { exact: true }).fill('125000');
  await form.getByLabel('Lý do', { exact: true }).fill('Đã đối chiếu hoàn tiền thực tế');
  await form.getByRole('button', { name: 'Lưu khoản hoàn', exact: true }).click();
  await expect(form.getByLabel('Mã chứng từ', { exact: true })).toHaveValue('REFUND-LOCAL');
  await expect(form.getByRole('button', { name: 'Lưu khoản hoàn', exact: true })).toBeEnabled();
  expect(api.refunds).toHaveLength(0);
  await page.getByRole('link', { name: 'Quay lại đơn hàng', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Rời khỏi đơn hàng?', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ở lại', exact: true }).click();
  api.loseNextRefundResponse();
  await form.getByRole('button', { name: 'Lưu khoản hoàn', exact: true }).click();
  await expect(form.getByLabel('Số tiền VND', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Thử lại đúng khoản hoàn', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(page.locator('.after-sales-ledgers')).toContainText('REFUND-LOCAL');
  expect(api.refunds).toHaveLength(1);
  expect(api.afterSalesWrites).toHaveLength(3);
  expect(api.afterSalesWrites[2]?.body).toEqual(api.afterSalesWrites[1]?.body);
  expect(api.afterSalesWrites[1]?.body.operationId).not.toBe(
    api.afterSalesWrites[0]?.body.operationId,
  );
  await page.reload();
  await expect(page.locator('.after-sales-ledgers')).toContainText('REFUND-LOCAL');
});

test('after-sales: return requires every dispatched line before closing COD and retries without restocking twice', async ({
  page,
  context,
  catalog,
}) => {
  catalog.setPermissions(AFTER_SALES_GRANTS);
  const api = await installAfterSalesApi(context, false);
  api.seedShipment();
  api.seedShipment();
  api.loseNextReturnResponse();
  await ready(page, `/admin/orders/${ORDER_ID}`);
  await page.getByRole('button', { name: 'Nhận hàng trả về', exact: true }).click();
  const form = page.locator('.after-sales-form').filter({ hasText: 'Nhận hàng vật lý đã trả' });
  const quantities = form.getByRole('spinbutton', { name: 'Số lượng nhận', exact: true });
  const cod = form.getByRole('checkbox', {
    name: 'Đã nhận lại toàn bộ hàng đã xuất; đóng COD còn lại của đơn',
    exact: true,
  });
  await quantities.nth(0).fill('1');
  await expect(cod).toBeDisabled();
  await quantities.nth(1).fill('1');
  await expect(cod).toBeEnabled();
  await form.getByRole('spinbutton', { name: 'Số lượng nhập kho', exact: true }).nth(0).fill('1');
  await cod.check();
  await form.getByLabel('Mã chứng từ', { exact: true }).fill('RETURN-LOCAL');
  await form.getByLabel('Lý do', { exact: true }).fill('Nhận lại đủ hàng đã giao');
  await form.getByRole('button', { name: 'Lưu phiếu nhận', exact: true }).click();
  await expect(quantities.nth(0)).toBeDisabled();
  await page.getByRole('button', { name: 'Thử lại đúng phiếu nhận', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(page.locator('.after-sales-ledgers')).toContainText('RETURN-LOCAL');
  await expect(page.locator('.after-sales-summary')).toContainText('Đơn đã đóng');
  expect(api.returns).toHaveLength(1);
  expect(api.returns[0]?.items.reduce((sum, item) => sum + item.restockQuantity, 0)).toBe(1);
  expect(api.afterSalesWrites[1]?.body).toEqual(api.afterSalesWrites[0]?.body);
});

test('after-sales: view-only users cannot write and restock requires its independent permission', async ({
  page,
  context,
  catalog,
}) => {
  catalog.setPermissions(
    AFTER_SALES_GRANTS.filter(
      (grant) => grant !== 'Permissions.Inventory.Adjust' && grant !== 'Permissions.Refund.Confirm',
    ),
  );
  const api = await installAfterSalesApi(context);
  api.seedShipment();
  await ready(page, `/admin/orders/${ORDER_ID}`);
  await expect(page.getByRole('button', { name: 'Ghi nhận hoàn tiền', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Nhận hàng trả về', exact: true }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Số lượng nhập kho', exact: true }),
  ).toBeDisabled();
  expect(api.afterSalesWrites).toEqual([]);
  catalog.setPermissions([
    'Permissions.Order.View',
    'Permissions.Shipping.View',
    'Permissions.AfterSales.View',
  ]);
  await page.reload();
  await expect(page.locator('.after-sales-summary')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ghi nhận hoàn tiền', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'Nhận hàng trả về', exact: true })).toHaveCount(0);
  expect(api.afterSalesWrites).toEqual([]);
});
