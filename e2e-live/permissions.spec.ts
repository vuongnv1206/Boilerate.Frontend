import { randomUUID } from 'node:crypto';
import { test, expect, signInAs, apiAs } from './fixtures';

test('live permissions: viewing, product editing, pricing and stock adjustments remain independent', async ({
  page,
  live,
  liveApi,
  baseURL,
}) => {
  const item = live.products.find((product) => product.slug === 'tui-everyday-tote')!;
  const path = `/admin/collections/products/${item.id}`;
  await signInAs(page, live.actors['viewer']!, path);
  await expect(page.locator('#product-name')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page.locator('#login-email')).toBeVisible();
  await signInAs(page, live.actors['catalogEditor']!, path);
  await expect(page.locator('#product-name')).toBeEditable();
  await expect(page.locator('.wf-single-variant input[id^="variant-price-"]')).toBeDisabled();
  await expect(page.locator('.wf-single-variant input[id^="variant-quantity-"]')).toBeDisabled();
  const editor = await apiAs(baseURL!, live.actors['catalogEditor']!);
  try {
    const inventory = await liveApi.get('/api/inventory', { params: { productId: item.id } });
    expect(inventory.status()).toBe(200);
    const balance = ((await inventory.json()) as { items: { id: string; version: string }[] })
      .items[0]!;
    const denied = await editor.post(`/api/inventory/${balance.id}/adjustments`, {
      data: {
        inventoryItemId: balance.id,
        version: balance.version,
        operationId: randomUUID(),
        delta: 1,
        reason: 'Must be forbidden',
      },
    });
    expect(denied.status()).toBe(403);
  } finally {
    await editor.dispose();
  }
});

test('live permissions: Return.Receive permits inspection while Inventory.Adjust independently protects restock', async ({
  page,
  live,
  liveApi,
  baseURL,
}) => {
  let selected:
    { id: string; version: string; shipmentId: string; orderItemId: string } | undefined;
  for (const order of live.orders) {
    const shipments = await liveApi.get(`/api/admin/orders/${order.id}/shipments`);
    expect(shipments.status()).toBe(200);
    const first = (
      (await shipments.json()) as { id: string; items: { orderItemId: string }[] }[]
    )[0];
    if (first?.items.length) {
      const detail = await liveApi.get(`/api/admin/orders/${order.id}`);
      selected = {
        id: order.id,
        version: (await detail.json()).version as string,
        shipmentId: first.id,
        orderItemId: first.items[0]!.orderItemId,
      };
      break;
    }
  }
  expect(selected, 'development seed includes an actually dispatched physical order').toBeTruthy();
  await signInAs(page, live.actors['operations']!, `/admin/orders/${selected!.id}`);
  await page.getByRole('button', { name: 'Nhận hàng trả về', exact: true }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Số lượng nhận', exact: true }).first(),
  ).toBeEditable();
  await expect(
    page.getByRole('spinbutton', { name: 'Số lượng nhập kho', exact: true }).first(),
  ).toBeDisabled();
  const operations = await apiAs(baseURL!, live.actors['operations']!);
  try {
    const denied = await operations.post(`/api/admin/orders/${selected!.id}/returns`, {
      data: {
        orderVersion: selected!.version,
        operationId: randomUUID(),
        reference: `DENY_${randomUUID()}`,
        reason: 'Restock requires independent inventory permission',
        closeRemainingCod: false,
        items: [
          {
            shipmentId: selected!.shipmentId,
            orderItemId: selected!.orderItemId,
            quantity: 1,
            restockQuantity: 1,
          },
        ],
      },
    });
    expect(denied.status()).toBe(403);
  } finally {
    await operations.dispose();
  }
});
