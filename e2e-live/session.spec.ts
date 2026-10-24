import { test, expect, signIn } from './fixtures';

test('live session: login preserves a protected deep link and reload restores its cookie session', async ({
  page,
  context,
  live,
  liveApi,
}) => {
  const product = live.products.find((item) => item.slug === 'tui-everyday-tote');
  expect(product).toBeTruthy();
  const path = `/admin/collections/products/${product!.id}`;
  await signIn(page, live, path);
  await expect(page).toHaveURL(new RegExp(`${path}$`, 'u'));
  await expect(page.locator('#product-name')).toHaveValue(product!.name);
  const before = (await context.cookies()).find((cookie) => cookie.name === 'boilerate.refresh');
  expect(before).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/api/tokens/session' });

  const refresh = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/tokens/session/refresh') &&
      response.request().method() === 'POST',
  );
  await page.reload();
  expect((await refresh).status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`${path}$`, 'u'));
  await expect(page.locator('#product-name')).toHaveValue(product!.name);
  const after = (await context.cookies()).find((cookie) => cookie.name === 'boilerate.refresh');
  expect(after?.value).toBeTruthy();
  expect(after?.value).not.toBe(before?.value);

  const browserData = await page.evaluate(() => ({
    cookie: document.cookie,
    entries: [...Object.entries(localStorage), ...Object.entries(sessionStorage)],
  }));
  expect(browserData.cookie).not.toContain('boilerate.refresh');
  expect(JSON.stringify(browserData.entries)).not.toContain(live.credentials.admin.password);
  expect(browserData.entries.some(([key]) => /token|password|credential/iu.test(key))).toBe(false);
  expect(JSON.stringify(browserData.entries)).not.toContain(before!.value);
  expect(JSON.stringify(browserData.entries)).not.toContain(after!.value);

  const persisted = await liveApi.get(`/api/products/${product!.id}`);
  expect(persisted.status()).toBe(200);
  expect((await persisted.json()).name).toBe(product!.name);
});

test('live session: logout revokes the cookie and reload returns to login', async ({
  page,
  context,
  live,
}) => {
  await signIn(page, live);
  const logout = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/tokens/session') && response.request().method() === 'DELETE',
  );
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  expect((await logout).status()).toBe(204);
  await expect(page.locator('#login-email')).toBeVisible();
  expect((await context.cookies()).some((cookie) => cookie.name === 'boilerate.refresh')).toBe(
    false,
  );
  await page.reload();
  await expect(page.locator('#login-email')).toBeVisible();
  await expect(page.locator('.workspace')).toHaveCount(0);
});

test('live API: an authenticated basic account cannot read the protected product catalogue', async ({
  basicApi,
}) => {
  const response = await basicApi.post('/api/products/search', {
    data: { pageNumber: 1, pageSize: 10 },
  });
  expect(response.status()).toBe(403);
});
