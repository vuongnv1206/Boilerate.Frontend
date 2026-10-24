import { randomUUID } from 'node:crypto';
import { request } from '@playwright/test';
import { test, expect, signIn } from './fixtures';

test('live system: create/edit user, assign role, disable account and enforce the final-admin guard', async ({
  page,
  live,
  liveApi,
  baseURL,
}) => {
  test.setTimeout(100_000);
  const key = randomUUID().replaceAll('-', '');
  const email = `ui-${key}@example.test`;
  const password = `Ui!${key}Z9`;
  await signIn(page, live, '/admin/system/users/new');
  await page.locator('#user-first-name').fill('Live');
  await page.locator('#user-last-name').fill('Operator');
  await page.locator('#user-email').fill(email);
  await page.locator('#user-username').fill(`ui${key}`);
  await page.locator('#user-password').fill(password);
  await page.locator('#user-confirm-password').fill(password);
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/users/create') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Tạo người dùng', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(200);
  const search = await liveApi.post('/api/users/search', {
    data: { keyword: email, pageNumber: 1, pageSize: 10 },
  });
  expect(search.status()).toBe(200);
  const id = ((await search.json()) as { data: { id: string }[] }).data[0]!.id;
  await page.goto(`/admin/system/users/${id}`);
  await expect(page.getByRole('button', { name: 'Lưu hồ sơ', exact: true })).toBeVisible();
  await page.locator('#user-first-name').fill('Updated live');
  const edited = page.waitForResponse(
    (result) => result.url().endsWith(`/api/users/${id}`) && result.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
  expect((await edited).status()).toBe(200);
  await page.getByRole('button', { name: 'Vai trò được gán', exact: true }).click();
  await page
    .locator('.permission-action')
    .filter({ hasText: live.actors['viewer']!.role })
    .getByRole('checkbox')
    .check();
  const rolesSaved = page.waitForResponse(
    (result) =>
      result.url().endsWith(`/api/users/${id}/roles`) && result.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Lưu vai trò', exact: true }).click();
  expect((await rolesSaved).status()).toBe(200);
  const roles = await liveApi.get(`/api/users/${id}/roles`);
  expect(roles.status()).toBe(200);
  expect(
    ((await roles.json()) as { roleName: string; enabled: boolean }[]).some(
      (role) => role.roleName === live.actors['viewer']!.role && role.enabled,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Vô hiệu hóa tài khoản', exact: true }).click();
  const disabled = page.waitForResponse((result) =>
    result.url().endsWith(`/api/users/${id}/toggle-status`),
  );
  await page
    .getByRole('dialog', { name: 'Xác nhận thao tác', exact: true })
    .getByRole('button', { name: 'Xác nhận', exact: true })
    .click();
  expect((await disabled).status()).toBe(200);
  const persisted = await liveApi.get(`/api/users/${id}`);
  expect(persisted.status()).toBe(200);
  expect(await persisted.json()).toMatchObject({ firstName: 'Updated live', isActive: false });
  expect((await liveApi.post(`/api/users/${id}/password-reset`)).status()).toBe(403);
  const login = await request.newContext({ baseURL });
  try {
    const denied = await login.post('/api/tokens/get', { data: { email, password } });
    expect(denied.status()).toBe(401);
  } finally {
    await login.dispose();
  }
  const users = await liveApi.post('/api/users/search', {
    data: { keyword: live.credentials.admin.email, pageNumber: 1, pageSize: 10 },
  });
  expect(users.status()).toBe(200);
  const admin = ((await users.json()) as { data: { id: string; version: string }[] }).data[0]!;
  const guarded = await liveApi.post(`/api/users/${admin.id}/toggle-status`, {
    data: { userId: admin.id, version: admin.version, activateUser: false },
  });
  expect(guarded.status()).toBe(409);
  const stillActive = await liveApi.get(`/api/users/${admin.id}`);
  expect((await stillActive.json()).isActive).toBe(true);
});
