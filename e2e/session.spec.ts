import { expect, test, ready, finishSignIn, FIRST_PRODUCT_ID } from './helpers/catalog-api';

test('session: reload restores the protected URL without storing tokens in JavaScript', async ({
  page,
  context,
  catalog,
}) => {
  const path = `/admin/collections/products/${FIRST_PRODUCT_ID}`;
  await ready(page, path);
  const original = await page.locator('#product-name').inputValue();
  const before = (await context.cookies()).find((cookie) => cookie.name === 'boilerate.refresh');
  expect(before).toMatchObject({
    httpOnly: true,
    sameSite: 'Strict',
    path: '/api/tokens/session',
  });

  await page.reload();
  await expect(page.locator('.workspace')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${path}$`, 'u'));
  await expect(page.locator('#product-name')).toHaveValue(original);
  expect(
    catalog.requests.filter(
      (request) => request.path === 'tokens/session' && request.method === 'POST',
    ),
  ).toHaveLength(1);
  const after = (await context.cookies()).find((cookie) => cookie.name === 'boilerate.refresh');
  expect(after?.value).toBeTruthy();
  expect(after?.value).not.toBe(before?.value);
  const browserData = await page.evaluate(() => ({
    cookie: document.cookie,
    storage: [...Object.values(localStorage), ...Object.values(sessionStorage)],
  }));
  expect(browserData.cookie).not.toContain('boilerate.refresh');
  expect(browserData.storage.join(' ')).not.toMatch(/browser-test-(?:access|refresh)/u);
});

test('session: logout removes the cookie and reload stays on login', async ({ page, context }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page.locator('#login-email')).toBeVisible();
  await expect
    .poll(async () =>
      (await context.cookies()).some((cookie) => cookie.name === 'boilerate.refresh'),
    )
    .toBe(false);
  await page.reload();
  await expect(page.locator('#login-email')).toBeVisible();
  await expect(page.locator('.workspace')).toHaveCount(0);
});

test('session: a revoked cookie returns to login and keeps the requested URL', async ({
  page,
  catalog,
}) => {
  const path = `/admin/collections/products/${FIRST_PRODUCT_ID}`;
  await ready(page, path);
  catalog.revokeSession();
  await page.reload();
  await expect(page.locator('#login-email')).toBeVisible();
  await expect(page.locator('.workspace')).toHaveCount(0);
  await finishSignIn(page);
  await expect(page).toHaveURL(new RegExp(`${path}$`, 'u'));
  await expect(page.locator('#product-name')).toHaveValue('Túi Everyday Tote');
});

test('session: two tabs can reload together while the refresh cookie rotates', async ({
  page,
  context,
  catalog,
}) => {
  await ready(page);
  const second = await context.newPage();
  await second.goto('/admin/collections/categories');
  await expect(second.locator('.workspace')).toBeVisible();
  await Promise.all([page.reload(), second.reload()]);
  await expect(page.locator('.workspace')).toBeVisible();
  await expect(second.locator('.workspace')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/collections\/products$/u);
  await expect(second).toHaveURL(/\/admin\/collections\/categories$/u);
  expect(
    catalog.requests.filter(
      (request) => request.path === 'tokens/session' && request.method === 'POST',
    ),
  ).toHaveLength(1);
});

test('session: logout in one tab also closes the other tab session', async ({ page, context }) => {
  await ready(page);
  const second = await context.newPage();
  await second.goto('/admin/collections/categories');
  await expect(second.locator('.workspace')).toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page.locator('#login-email')).toBeVisible();
  await expect(second.locator('#login-email')).toBeVisible();
  await expect(second.locator('.workspace')).toHaveCount(0);
  await second.reload();
  await expect(second.locator('#login-email')).toBeVisible();
});
