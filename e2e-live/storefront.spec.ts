import { randomUUID } from 'node:crypto';
import type { APIRequestContext, BrowserContext, Page, TestInfo } from '@playwright/test';
import { apiAs, signIn, test, expect } from './fixtures';

type AcceptanceMail = { to: string[]; subject: string; body: string | null };

async function beginGuestCheckout(page: Page, name: string) {
  await page.goto('/shop/products');
  await page.locator('.product-card').getByRole('link', { name }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByText(/nội dung tiếng Việt dài để rà bố cục/)).toBeVisible();
  const add = page.getByRole('button', { name: /Thêm vào giỏ hàng/ });
  await expect(add).toBeEnabled();
  await add.focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Giỏ hàng').click();
  await expect
    .poll(async () =>
      (await page.context().cookies()).find((cookie) => cookie.name === 'boilerate_guest_cart'),
    )
    .toMatchObject({ httpOnly: true, sameSite: 'Lax' });
  await page.getByRole('button', { name: /Tiến hành đặt hàng/ }).click();
  await expect(page.getByRole('heading', { name: 'Xác nhận & Đặt hàng' })).toBeVisible();
}

async function verifyGuestEmail(
  page: Page,
  sink: APIRequestContext,
  context: BrowserContext,
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

  const drained = await sink.post('/__acceptance/outbox/drain');
  expect(drained.status()).toBe(200);
  const response = await sink.get('/__acceptance/mail-sink/messages');
  expect(response.status()).toBe(200);
  const messages = (await response.json()) as AcceptanceMail[];
  const mail = [...messages]
    .reverse()
    .find(
      (candidate) =>
        candidate.subject === 'Mã xác minh email mua hàng' && candidate.to.includes(email),
    );
  if (!mail) throw new Error('The guest email outbox did not reach the in-memory mail sink.');
  const code = mail.body?.match(/<strong>(\d{6})<\/strong>/u)?.[1];
  expect(code).toMatch(/^\d{6}$/u);

  if (!code)
    throw new Error('The mail sink message did not contain a six-digit verification code.');
  await page.getByLabel('Mã xác minh').fill(code);
  await page.getByRole('button', { name: 'Xác minh email' }).click();
  await expect(page.getByText(/Email đã được xác minh/)).toBeVisible();
  const accessCookie = (await context.cookies()).find(
    (cookie) => cookie.name === 'boilerate_guest_access',
  );
  expect(accessCookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
}

async function saveBankSettings(
  page: Page,
  liveApi: APIRequestContext,
  settings: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    branch: string;
    instructions: string;
    bankTransferEnabled: boolean;
  },
) {
  await page.getByLabel(/Ngân hàng/).fill(settings.bankName);
  await page.getByLabel(/Số tài khoản/).fill(settings.accountNumber);
  await page.getByLabel(/Chủ tài khoản/).fill(settings.accountHolder);
  await page.getByLabel(/Chi nhánh/).fill(settings.branch);
  await page.getByLabel(/Hướng dẫn chuyển khoản/).fill(settings.instructions);
  await page.getByRole('button', { name: 'Lưu cài đặt' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu thông tin thanh toán.');

  const response = await liveApi.get('/api/storefront/settings');
  expect(response.status(), await response.text()).toBe(200);
  expect(await response.json()).toMatchObject(settings);
}

test('guest buys physical stock by COD, verifies through the outbox mail sink and sees My Orders', async ({
  page,
  context,
  live,
}, testInfo: TestInfo) => {
  const sink = await apiAs(live.backendUrl, live.credentials.admin);
  try {
    const email = `guest-physical-${testInfo.project.name}@example.test`;
    await beginGuestCheckout(page, live.storefront.physicalName);
    await verifyGuestEmail(page, sink, context, email);
    await page.getByLabel('Họ và tên').fill('Nguyễn Thị Bích Ngọc');
    await page.getByLabel('Số điện thoại').fill('0901234567');
    await page
      .getByLabel('Địa chỉ nhận hàng')
      .fill('12 Đường Nguyễn Huệ, Phường Hải Châu, Đà Nẵng');
    await page.getByLabel(/Thu hộ tiền mặt khi nhận hàng/).check();
    await page.getByRole('button', { name: /Đặt hàng ngay/ }).click();
    await expect(page.getByRole('heading', { name: /Đơn hàng #/ })).toBeVisible();

    const number = (await page.locator('.banner-title').innerText()).replace('Đơn hàng #', '');
    await page.getByRole('navigation').getByRole('link', { name: 'Đơn hàng', exact: true }).click();
    await expect(page.locator('.order-card')).toContainText(number);
    await expect(page.locator('.order-card')).toContainText('Nguyễn Thị Bích Ngọc');
    await expect(page.locator('.order-card')).toContainText('Thu hộ COD');
  } finally {
    await sink.dispose();
  }
});

test('guest prepays for digital stock and only sees delivered content after staff confirms payment', async ({
  page,
  context,
  live,
  liveApi,
}, testInfo: TestInfo) => {
  const sink = await apiAs(live.backendUrl, live.credentials.admin);
  try {
    const email = `guest-digital-${testInfo.project.name}@example.test`;
    await beginGuestCheckout(page, live.storefront.digitalName);
    await verifyGuestEmail(page, sink, context, email);
    await page.getByLabel('Họ và tên').fill('Lê Minh Anh');
    await page.getByLabel('Số điện thoại').fill('0912345678');
    await expect(page.getByLabel(/Thu hộ tiền mặt khi nhận hàng/)).toBeDisabled();
    await page.getByRole('button', { name: /Đặt hàng ngay/ }).click();
    await expect(page.getByRole('heading', { name: /Đơn hàng #/ })).toBeVisible();
    await expect(page.getByText(live.storefront.accountNumber)).toBeVisible();
    await expect(page.getByText(/Nhân viên sẽ đối soát và xác nhận tiền thủ công/)).toBeVisible();
    await expect(page.getByText(live.storefront.digitalContent)).toHaveCount(0);

    const orderId = new URL(page.url()).pathname.split('/').at(-1);
    if (!orderId) throw new Error('Checkout did not navigate to an order detail URL.');
    const orderResponse = await liveApi.get(`/api/admin/orders/${orderId}`);
    expect(orderResponse.status(), await orderResponse.text()).toBe(200);
    const order = (await orderResponse.json()) as { version: string; total: number };
    const payment = await liveApi.post(`/api/admin/orders/${orderId}/payment-confirmations`, {
      data: {
        version: order.version,
        operationId: randomUUID(),
        reference: `GUEST-LIVE-${randomUUID().slice(0, 8)}`,
        amount: order.total,
        currency: 'VND',
        receivedAtUtc: new Date(Date.now() - 1000).toISOString(),
        source: 'ManualBankTransfer',
      },
    });
    expect(payment.status(), await payment.text()).toBe(200);

    await page.reload();
    await expect(page.getByRole('heading', { name: /Đơn hàng #/ })).toBeVisible();
    await expect(page.getByText(live.storefront.digitalContent)).toBeVisible();
  } finally {
    await sink.dispose();
  }
});

test('staff updates the bank transfer details in Admin and exposes them to checkout', async ({
  page,
  live,
  liveApi,
}) => {
  await signIn(page, live, '/admin/storefront-settings');
  await expect(page.getByRole('heading', { name: 'Thông tin nhận chuyển khoản' })).toBeVisible();
  await saveBankSettings(page, liveApi, {
    bankName: 'Ngân hàng live UI',
    accountNumber: '0987654321',
    accountHolder: 'BOILERATE LIVE UI',
    branch: 'Chi nhánh live UI',
    instructions: 'Ghi mã đơn hàng vào nội dung chuyển khoản.',
    bankTransferEnabled: true,
  });
  await saveBankSettings(page, liveApi, {
    bankName: live.storefront.bankName,
    accountNumber: live.storefront.accountNumber,
    accountHolder: live.storefront.accountHolder,
    branch: 'Chi nhánh kiểm thử',
    instructions: 'Ghi mã đơn trong nội dung chuyển khoản.',
    bankTransferEnabled: true,
  });
});
