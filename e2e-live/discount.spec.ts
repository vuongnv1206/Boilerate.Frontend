import { randomUUID } from 'node:crypto';
import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import { apiAs, expect, test } from './fixtures';

test('live discount: guest checkout uses the server quote and stores its snapshot', async ({
  page,
  context,
  live,
  liveApi,
  basicApi,
}, testInfo: TestInfo) => {
  test.setTimeout(90_000);
  const code = `LIVE${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
  const created = await liveApi.post('/api/admin/discounts', {
    data: {
      code,
      name: 'Ưu đãi kiểm thử',
      kind: 1,
      value: 10,
      minimumSubtotal: 0,
      startsAtUtc: null,
      endsAtUtc: null,
      usageLimit: 1,
      isActive: true,
    },
  });
  expect(created.status(), await created.text()).toBe(200);
  const discount = (await created.json()) as { id: string };
  expect((await basicApi.get('/api/admin/discounts')).status()).toBe(403);

  await page.goto('/shop/products');
  await page.getByRole('link', { name: live.storefront.physicalName }).click();
  await page.getByRole('button', { name: /Thêm vào giỏ hàng/ }).click();
  await page.getByLabel('Giỏ hàng').click();
  await page.getByLabel('Mã giảm giá', { exact: true }).fill(code.toLowerCase());
  const applied = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/storefront/cart/discount') &&
      response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  expect((await applied).status()).toBe(200);
  await expect(page.getByText(`Đã áp dụng mã ${code}.`)).toBeVisible();
  const cartResponse = await context.request.get('/api/storefront/cart');
  expect(cartResponse.status()).toBe(200);
  const cart = (await cartResponse.json()) as {
    discountCode: string;
    discountAmount: number;
    subtotal: number;
    shippingAmount: number;
    total: number;
  };
  expect(cart.discountCode).toBe(code);
  expect(cart.discountAmount).toBe(12_300);
  expect(cart.total).toBe(cart.subtotal + cart.shippingAmount - cart.discountAmount);
  await page.screenshot({ path: testInfo.outputPath('discount-cart.png') });
  await page.reload();
  await expect(page.getByText(`Đã áp dụng mã ${code}.`)).toBeVisible();
  await page.getByRole('button', { name: /Tiến hành đặt hàng/ }).click();

  const sink = await apiAs(live.backendUrl, live.credentials.admin);
  try {
    const email = `discount-${testInfo.project.name}@example.test`;
    await verifyEmail(page, context, sink, email);
    await page.getByLabel('Họ và tên').fill('Nguyễn Thị Bích Ngọc');
    await page.getByLabel('Số điện thoại').fill('0901234567');
    await page.getByLabel('Địa chỉ nhận hàng').fill('12 Đường Nguyễn Huệ, Đà Nẵng');
    await page.getByLabel(/Thu hộ tiền mặt khi nhận hàng/).check();
    await expect(page.getByText('Giảm giá', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Đặt hàng ngay/ }).click();
    await expect(page.getByRole('heading', { name: /Đơn hàng #/ })).toBeVisible();
    await expect(page.getByText(`Giảm giá (${code})`)).toBeVisible();

    const orderId = new URL(page.url()).pathname.split('/').at(-1);
    expect(orderId).toBeTruthy();
    const response = await liveApi.get(`/api/admin/orders/${orderId}`);
    expect(response.status(), await response.text()).toBe(200);
    expect(await response.json()).toMatchObject({
      discountCode: code,
      discountAmount: cart.discountAmount,
      total: cart.total,
    });
    const usage = await liveApi.get(`/api/admin/discounts/${discount.id}`);
    expect(usage.status()).toBe(200);
    expect(await usage.json()).toMatchObject({ usedCount: 1 });
  } finally {
    await sink.dispose();
  }
});

async function verifyEmail(
  page: Page,
  context: BrowserContext,
  sink: Awaited<ReturnType<typeof apiAs>>,
  email: string,
) {
  await page.getByLabel(/Email dùng để xác minh/).fill(email);
  const requested = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/storefront/access/request-code') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Gửi mã xác minh' }).click();
  expect((await requested).status()).toBe(202);
  expect((await sink.post('/__acceptance/outbox/drain')).status()).toBe(200);
  const response = await sink.get('/__acceptance/mail-sink/messages');
  expect(response.status()).toBe(200);
  const messages = (await response.json()) as {
    to: string[];
    subject: string;
    body: string | null;
  }[];
  const mail = [...messages]
    .reverse()
    .find((item) => item.subject === 'Mã xác minh email mua hàng' && item.to.includes(email));
  const code = mail?.body?.match(/<strong>(\d{6})<\/strong>/u)?.[1];
  if (!code) throw new Error('The acceptance mail sink did not contain the verification code.');
  await page.getByLabel('Mã xác minh').fill(code);
  await page.getByRole('button', { name: 'Xác minh email' }).click();
  await expect(page.getByText(/Email đã được xác minh/)).toBeVisible();
  const cookie = (await context.cookies()).find((item) => item.name === 'boilerate_guest_access');
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
}
