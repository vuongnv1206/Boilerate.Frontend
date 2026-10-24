import { randomUUID } from 'node:crypto';
import { test, expect, signIn, apiAs } from './fixtures';

interface Capability {
  id: string;
  code: string;
  name: string;
  version: string;
  isActive: boolean;
}

interface Function extends Capability {
  actionDtos: (Capability & { selected: boolean })[];
}

test('live system permissions: Function–Action configuration and role grants persist and revoke independently', async ({
  page,
  live,
  liveApi,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const key = randomUUID().replaceAll('-', '');
  const groupResponse = await liveApi.post('/api/function-groups', {
    data: { code: `LIVE_GROUP_${key}`, name: `Live group ${key}`, sortOrder: 900 },
  });
  expect(groupResponse.status()).toBe(200);
  const group = (await groupResponse.json()) as { id: string };
  const actionResponse = await liveApi.post('/api/actions', {
    data: { code: `LIVE_ACTION_${key}`, name: `Live action ${key}`, isActive: true },
  });
  expect(actionResponse.status()).toBe(200);
  const action = (await actionResponse.json()) as Capability;
  const functionResponse = await liveApi.post('/api/functions', {
    data: {
      code: `LIVE_FUNCTION_${key}`,
      name: `Live function ${key}`,
      groupId: group.id,
      isActive: true,
    },
  });
  expect(functionResponse.status()).toBe(200);
  const fn = (await functionResponse.json()) as Function;
  const roleResponse = await liveApi.post('/api/roles', {
    data: { name: `Live scoped role ${key}`, description: 'One-run ACL acceptance role' },
  });
  expect(roleResponse.status()).toBe(200);
  const roleId = (await roleResponse.text()).trim().replace(/^"|"$/gu, '');

  const actionName = `${action.name} updated`;
  await signIn(page, live, `/admin/system/actions/${action.id}`);
  await page.locator('#capability-name').fill(actionName);
  const actionSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/actions/${action.id}`) && response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
  expect((await actionSaved).status()).toBe(200);
  await expect(page.locator('#capability-name')).toHaveValue(actionName);
  await expect(page.locator('.editor-notice[role="status"]')).toContainText('Đã lưu');

  const functionName = `${fn.name} updated`;
  await page.goto(`/admin/system/functions/${fn.id}`);
  await page.locator('#capability-name').fill(functionName);
  const functionSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/functions/${fn.id}`) && response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
  expect((await functionSaved).status()).toBe(200);
  await expect(page.locator('.editor-notice[role="status"]')).toContainText('Đã lưu');
  await page
    .locator('.system-action-config .permission-action')
    .filter({ hasText: actionName })
    .getByRole('checkbox')
    .check();
  const mappingSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/functions/${fn.id}/actions`) &&
      response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Lưu cấu hình hành động', exact: true }).click();
  expect((await mappingSaved).status()).toBe(200);
  await expect(
    page.getByRole('button', { name: 'Lưu cấu hình hành động', exact: true }),
  ).toBeDisabled();
  const persistedFunction = await liveApi.get(`/api/functions/${fn.id}`);
  expect(persistedFunction.status()).toBe(200);
  expect(
    ((await persistedFunction.json()) as Function).actionDtos.find((item) => item.id === action.id)
      ?.selected,
  ).toBe(true);

  await page.goto(`/admin/system/roles/${roleId}`);
  await page.getByRole('button', { name: 'Phân quyền truy cập', exact: true }).click();
  await page.locator('#permission-search').fill(fn.code);
  const grant = page.getByRole('checkbox', {
    name: `${actionName} — ${functionName}`,
    exact: true,
  });
  await expect(grant).toBeVisible();
  await grant.check();
  const grantsSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/roles/${roleId}/permissions`) &&
      response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Lưu quyền truy cập', exact: true }).click();
  expect((await grantsSaved).status()).toBe(200);
  await expect(
    page.getByRole('button', { name: 'Lưu quyền truy cập', exact: true }),
  ).toBeDisabled();

  const email = `acl-${key}@example.test`;
  const password = `Live!${key}Z9`;
  const userCreated = await liveApi.post('/api/users/create', {
    data: {
      firstName: 'Live ACL',
      lastName: key,
      email,
      userName: `acl${key}`,
      password,
      confirmPassword: password,
      phoneNumber: null,
    },
  });
  expect(userCreated.status()).toBe(200);
  const users = await liveApi.post('/api/users/search', {
    data: { keyword: email, pageNumber: 1, pageSize: 10 },
  });
  expect(users.status()).toBe(200);
  const user = ((await users.json()) as { data: { id: string; version: string }[] }).data[0]!;
  const assigned = await liveApi.put(`/api/users/${user.id}/roles`, {
    data: { version: user.version, roleIds: [roleId] },
  });
  expect(assigned.status()).toBe(200);
  const actor = await apiAs(baseURL!, { email, password });
  const permission = `Permissions.${fn.code}.${action.code}`;
  try {
    const authorized = await actor.get('/api/personal/authorization');
    expect(authorized.status()).toBe(200);
    expect(await authorized.json()).toMatchObject({
      isCentralAdmin: false,
      permissions: [permission],
    });
    await grant.uncheck();
    const revoked = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/roles/${roleId}/permissions`) &&
        response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Lưu quyền truy cập', exact: true }).click();
    expect((await revoked).status()).toBe(200);
    await expect(
      page.getByRole('button', { name: 'Lưu quyền truy cập', exact: true }),
    ).toBeDisabled();
    const authorizationAfterRevoke = await actor.get('/api/personal/authorization');
    expect(authorizationAfterRevoke.status()).toBe(200);
    expect((await authorizationAfterRevoke.json()).permissions).not.toContain(permission);
  } finally {
    await actor.dispose();
  }
  await page.reload();
  await page.getByRole('button', { name: 'Phân quyền truy cập', exact: true }).click();
  await page.locator('#permission-search').fill(fn.code);
  await expect(grant).not.toBeChecked();
  await page.goto(`/admin/system/actions/${action.id}`);
  await page.getByRole('checkbox', { name: 'Đang hoạt động', exact: true }).uncheck();
  const disabled = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/actions/${action.id}`) && response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
  expect((await disabled).status()).toBe(200);
  expect((await (await liveApi.get(`/api/actions/${action.id}`)).json()).isActive).toBe(false);
});
