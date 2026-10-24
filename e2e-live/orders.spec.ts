import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect, signIn } from './fixtures';

async function json<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(response.status(), await response.text()).toBe(200);
  return response.json() as Promise<T>;
}

async function checkout(
  api: APIRequestContext,
  variantId: string,
  email: string,
  paymentMethod: number,
) {
  const cart = await json<{ version: string }>(await api.get('/api/cart'));
  const ready = await json<{ version: string; total: number; canCheckout: boolean }>(
    await api.put('/api/cart', {
      data: { version: cart.version, items: [{ variantId, quantity: 2 }] },
    }),
  );
  expect(ready.canCheckout).toBe(true);
  return json<{ id: string; number: string; total: number }>(
    await api.post('/api/orders/checkout', {
      data: {
        cartVersion: ready.version,
        operationId: randomUUID(),
        paymentMethod,
        recipientName: 'Live operator',
        email,
        phone: '0900000000',
        shippingAddress: 'Live acceptance address',
        expectedTotal: ready.total,
      },
    }),
  );
}

async function payment(page: Page, id: string, reference: string) {
  await page.getByRole('button', { name: 'Xác nhận thanh toán', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Xác nhận thanh toán', exact: true });
  await dialog.getByLabel('Mã giao dịch', { exact: true }).fill(reference);
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/admin/orders/${id}/payment-confirmations`) &&
      response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.order-inspector')).toContainText('Đã thanh toán');
}

async function dispatch(page: Page, id: string, name: string, tracking: string, quantity = '1') {
  const reloadedAfterDispatch = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/admin/orders/${id}`) && response.request().method() === 'GET',
  );
  await page.getByRole('button', { name: 'Tạo lần giao', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Tạo lần giao hàng', exact: true });
  await dialog.getByLabel('Hãng vận chuyển *', { exact: true }).fill('Live carrier');
  await dialog.getByLabel('Mã vận chuyển *', { exact: true }).fill(tracking);
  await dialog.getByLabel(`Số lượng giao: ${name}`, { exact: true }).fill(quantity);
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/admin/orders/${id}/shipments`) &&
      response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Tạo đợt giao hàng', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(dialog).not.toBeVisible();
  await reloadedAfterDispatch;
  const deliverButton = page.getByRole('button', { name: 'Xác nhận đã giao', exact: true });
  await expect(deliverButton).toBeVisible();
  const reloadedAfterDelivery = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/admin/orders/${id}`) && response.request().method() === 'GET',
  );
  await deliverButton.click();
  const delivery = page.getByRole('dialog', { name: 'Xác nhận giao thành công', exact: true });
  const delivered = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/admin/orders/${id}/shipments/`) &&
      response.url().endsWith('/deliver'),
  );
  await delivery.getByRole('button', { name: 'Xác nhận đã giao', exact: true }).click();
  expect((await delivered).status()).toBe(200);
  await expect(delivery).not.toBeVisible();
  await reloadedAfterDelivery;
  await expect(page.locator('.shipment-card')).toContainText('Đã giao');
}

test('live orders: prepaid/COD, partial shipment, refund, return and canonical rail use persisted data', async ({
  page,
  live,
  liveApi,
}, testInfo) => {
  test.setTimeout(150_000);
  const key = randomUUID().replaceAll('-', '');
  const type = await json<{ id: string; version: string }>(
    await liveApi.post('/api/product-types', {
      data: { code: `ORDER_${key}`, name: `Live orders ${key}`, fields: [] },
    }),
  );
  const name = `Live physical ${key}`;
  const product = await json<{ id: string; version: string; variants: { id: string }[] }>(
    await liveApi.post('/api/products', {
      data: {
        productTypeId: type.id,
        productTypeVersion: type.version,
        fulfillmentKind: 1,
        content: {
          name,
          slug: `live-order-${key}`,
          description: null,
          categoryIds: [],
          fields: [],
          media: [],
        },
        options: [],
        variants: [{ sku: `ORDER_${key}`, price: 100000, compareAtPrice: null, options: {} }],
      },
    }),
  );
  const stock = async () =>
    (
      await json<{ items: { id: string; version: string; onHand: number; reserved: number }[] }>(
        await liveApi.get('/api/inventory', { params: { productId: product.id } }),
      )
    ).items[0]!;
  const initial = await stock();
  const adjustment = {
    inventoryItemId: initial.id,
    version: initial.version,
    operationId: randomUUID(),
    delta: 10,
    reason: 'Live acceptance stock',
  };
  await json(await liveApi.post(`/api/inventory/${initial.id}/adjustments`, { data: adjustment }));
  await json(await liveApi.post(`/api/inventory/${initial.id}/adjustments`, { data: adjustment }));
  expect((await stock()).onHand).toBe(10);
  await json(
    await liveApi.post(`/api/products/${product.id}/status`, {
      data: { id: product.id, version: product.version, status: 2 },
    }),
  );
  const email = `live-${key}@example.test`;
  const prepaid = await checkout(liveApi, product.variants[0]!.id, email, 1);
  const cod = await checkout(liveApi, product.variants[0]!.id, email, 2);
  expect((await stock()).reserved).toBe(4);
  const query = `?q=${encodeURIComponent(email)}`;
  await signIn(page, live, `/admin/orders/${prepaid.id}${query}`);
  await payment(page, prepaid.id, `PAY_${key}`);
  await dispatch(page, prepaid.id, name, `PRE_${key}`);
  expect(await stock()).toMatchObject({ onHand: 9, reserved: 3 });
  await page.getByRole('button', { name: 'Ghi nhận hoàn tiền', exact: true }).click();
  const refundForm = page
    .locator('form.after-sales-form')
    .filter({ hasText: 'Ghi nhận khoản đã hoàn thực tế' });
  await refundForm.getByLabel('Mã chứng từ', { exact: true }).fill(`REF_${key}`);
  await refundForm.getByLabel('Số tiền VND', { exact: true }).fill('50000');
  await refundForm.getByLabel('Lý do', { exact: true }).fill('Live partial refund');
  const refundResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/admin/orders/${prepaid.id}/refunds`) &&
      response.request().method() === 'POST',
  );
  await refundForm.getByRole('button', { name: 'Lưu khoản hoàn', exact: true }).click();
  const refunded = await refundResponse;
  expect(refunded.status()).toBe(200);
  await expect(refundForm).not.toBeVisible();
  const refundPayload = refunded.request().postDataJSON();
  await json(
    await liveApi.post(`/api/admin/orders/${prepaid.id}/refunds`, { data: refundPayload }),
  );
  expect(await stock()).toMatchObject({ onHand: 9, reserved: 3 });
  await page.getByRole('button', { name: 'Nhận hàng trả về', exact: true }).click();
  const returnForm = page
    .locator('form.after-sales-form')
    .filter({ hasText: 'Nhận hàng vật lý đã trả' });
  await returnForm.getByLabel('Số lượng nhận', { exact: true }).fill('1');
  await returnForm.getByLabel('Số lượng nhập kho', { exact: true }).fill('1');
  await returnForm.getByLabel('Mã chứng từ', { exact: true }).fill(`RET_${key}`);
  await returnForm.getByLabel('Lý do', { exact: true }).fill('Live returned item');
  const returnResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/admin/orders/${prepaid.id}/returns`) &&
      response.request().method() === 'POST',
  );
  await returnForm.getByRole('button', { name: 'Lưu phiếu nhận', exact: true }).click();
  const returned = await returnResponse;
  expect(returned.status()).toBe(200);
  await expect(returnForm).not.toBeVisible();
  await json(
    await liveApi.post(`/api/admin/orders/${prepaid.id}/returns`, {
      data: returned.request().postDataJSON(),
    }),
  );
  expect(await stock()).toMatchObject({ onHand: 10, reserved: 3 });
  const summary = await json<{ refunds: unknown[]; returns: unknown[]; refundedAmount: number }>(
    await liveApi.get(`/api/admin/orders/${prepaid.id}/after-sales`),
  );
  expect(summary.refunds).toHaveLength(1);
  expect(summary.returns).toHaveLength(1);
  expect(summary.refundedAmount).toBe(50000);
  if (testInfo.project.name.startsWith('tablet'))
    await page.getByRole('button', { name: 'Danh sách đơn hàng', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Đơn hàng trong bộ lọc', exact: true })
    .getByRole('link')
    .filter({ hasText: cod.number })
    .click();
  await expect(page.locator('#order-detail-title')).toHaveText(cod.number);
  expect(new URL(page.url()).searchParams.get('q')).toBe(email);
  await dispatch(page, cod.id, name, `COD_${key}`, '2');
  expect(
    (await json<{ paymentStatus: number }>(await liveApi.get(`/api/admin/orders/${cod.id}`)))
      .paymentStatus,
  ).toBe(1);
  await payment(page, cod.id, `CODPAY_${key}`);
  await page.reload();
  await expect(page.locator('#order-detail-title')).toHaveText(cod.number);
  expect(
    (await json<{ paymentStatus: number }>(await liveApi.get(`/api/admin/orders/${cod.id}`)))
      .paymentStatus,
  ).toBe(2);
  await page.getByRole('link', { name: 'Quay lại đơn hàng', exact: true }).click();
  await expect(page.locator('.order-table tbody tr')).toHaveCount(2);
  expect(new URL(page.url()).searchParams.get('q')).toBe(email);
});
