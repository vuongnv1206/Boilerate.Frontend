import { expect, finishSignIn, ready, test } from './helpers/catalog-api';
import { installSystemApi } from './helpers/system-api';

test('system: home chooses the first system section when no Catalog grant exists', async ({
  page,
  context,
}) => {
  await installSystemApi(context, true, false);
  await page.goto('/admin');
  await finishSignIn(page);
  await expect(page).toHaveURL(/\/admin\/system\/roles$/u);
  await expect(
    page.getByRole('heading', { name: 'Vai trò và phân quyền', exact: true }),
  ).toBeVisible();
});

test('system: role matrix uses API actions and filtered bulk preserves hidden grants', async ({
  page,
  context,
}, testInfo) => {
  const api = await installSystemApi(context);
  await ready(page, '/admin/system/roles/editor');
  await page.getByRole('button', { name: 'Phân quyền truy cập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Màn hình và chức năng' })).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: 'Phê duyệt — Tự động hóa', exact: true }),
  ).toBeVisible();
  const group = page
    .locator('.permission-group')
    .filter({ has: page.getByRole('button', { name: /Danh mục và sản phẩm/u }) });
  await expect(
    group.getByRole('checkbox', { name: 'Xem trong nhóm Danh mục và sản phẩm', exact: true }),
  ).toHaveJSProperty('indeterminate', true);
  await page.getByLabel('Tìm kiếm chức năng', { exact: true }).fill('Product');
  await expect(page.locator('.permission-function')).toHaveCount(1);
  await group
    .getByRole('checkbox', { name: 'Thêm mới trong nhóm Danh mục và sản phẩm', exact: true })
    .check();
  await expect(
    page.getByRole('checkbox', { name: 'Xem — Sản phẩm', exact: true }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: 'Lưu quyền truy cập', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu');
  expect(api.permissions.get('editor')).toEqual([
    { functionId: 'product', actionId: 'create' },
    { functionId: 'category', actionId: 'view' },
  ]);
  await page.getByLabel('Tìm kiếm chức năng', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Thu gọn tất cả nhóm', exact: true }).click();
  await expect(page.locator('.permission-function')).toHaveCount(0);
  await page.getByRole('button', { name: 'Mở tất cả nhóm', exact: true }).click();
  await expect(page.locator('.permission-function')).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath('role-permissions.png'), fullPage: true });
});

test('system: role conflict keeps changes and navigation asks before discarding', async ({
  page,
  context,
}) => {
  const api = await installSystemApi(context);
  await ready(page, '/admin/system/roles/editor');
  await page.getByLabel('Tên vai trò', { exact: false }).fill('Tên đang chỉnh sửa');
  api.failNextSave(409);
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Tên vai trò', { exact: false })).toHaveValue('Tên đang chỉnh sửa');
  await page.getByRole('link', { name: 'Người dùng', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Bỏ thay đổi vai trò?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Ở lại', exact: true }).click();
  await expect(page.getByLabel('Tên vai trò', { exact: false })).toHaveValue('Tên đang chỉnh sửa');
});

test('system: create a role and assign it to an existing user', async ({ page, context }) => {
  const api = await installSystemApi(context);
  await ready(page, '/admin/system/roles');
  await page.getByRole('link', { name: 'Thêm vai trò', exact: true }).click();
  await page.getByLabel('Tên vai trò', { exact: false }).fill('Nhân viên kiểm thử');
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
  await expect(page).toHaveURL(/\/roles\/role-\d+#permissions$/u);
  await expect(
    page.getByRole('heading', { name: 'Màn hình và chức năng', exact: true }),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: 'Phê duyệt — Tự động hóa', exact: true }).check();
  await page.getByRole('button', { name: 'Lưu quyền truy cập', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu');
  await page.getByRole('link', { name: 'Người dùng', exact: true }).click();
  await page.getByRole('link', { name: 'Nhân viên Nội dung', exact: true }).click();
  await page.getByRole('button', { name: 'Vai trò được gán', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Nhân viên kiểm thử', exact: true }).check();
  await page.getByRole('button', { name: 'Lưu vai trò', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu vai trò');
  expect(api.writes.find((w) => w.path === 'users/worker/roles')?.body['roleIds']).toContain(
    api.roles.find((r) => r.name === 'Nhân viên kiểm thử')?.id,
  );
});

test('system users: creation validates input, renders field errors and leaves no saved draft', async ({
  page,
  context,
}, testInfo) => {
  const api = await installSystemApi(context);
  await ready(page, '/admin/system/users');
  await page.screenshot({ path: testInfo.outputPath('user-list.png'), fullPage: true });
  await page.getByRole('link', { name: 'Thêm người dùng', exact: true }).click();
  await page.getByLabel('Họ *', { exact: true }).fill('Nguyễn Văn');
  await page.getByLabel('Tên *', { exact: true }).fill('Nhân viên vận hành cửa hàng');
  await page.getByLabel('Email *', { exact: true }).fill('new-staff@example.test');
  await page.getByLabel('Tên đăng nhập *', { exact: true }).fill('new-staff');
  await page.getByLabel('Mật khẩu ban đầu *', { exact: true }).fill('InitialPassword!234');
  await page.getByLabel('Nhập lại mật khẩu *', { exact: true }).fill('MismatchPassword!234');
  await page.getByRole('button', { name: 'Tạo người dùng', exact: true }).click();
  await expect(page.getByText('Mật khẩu nhập lại chưa khớp.', { exact: true })).toBeVisible();
  expect(api.writes.filter((write) => write.path === 'users/create')).toHaveLength(0);
  await page.getByLabel('Nhập lại mật khẩu *', { exact: true }).fill('InitialPassword!234');
  api.failNextUserMutation(400, { UserName: ['Tên đăng nhập đã tồn tại.'] });
  await page.getByRole('button', { name: 'Tạo người dùng', exact: true }).click();
  await expect(page.locator('#user-username-error')).toHaveText('Tên đăng nhập đã tồn tại.');
  await expect(page.locator('#user-username')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#user-password')).toHaveValue('InitialPassword!234');
  await page.locator('#user-username').fill('new-staff-unique');
  await page.getByRole('button', { name: 'Tạo người dùng', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Tạo người dùng thành công', exact: true }),
  ).toBeVisible();
  expect(api.users.find((user) => user.userName === 'new-staff-unique')?.emailConfirmed).toBe(
    false,
  );
  await page.screenshot({ path: testInfo.outputPath('user-created.png'), fullPage: true });
  await page.getByRole('link', { name: 'Quay lại danh sách người dùng', exact: true }).click();
  await expect(page).toHaveURL(/\/system\/users$/u);
  await expect(page.getByRole('dialog', { name: 'Bỏ thay đổi người dùng?' })).toHaveCount(0);
  await page
    .getByRole('link', { name: 'Nguyễn Văn Nhân viên vận hành cửa hàng', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Gửi link đặt lại mật khẩu', exact: true }),
  ).toBeDisabled();
});

test('system users: conflict retains profile and image draft, reload asks and a retry uses the version', async ({
  page,
  context,
}, testInfo) => {
  const api = await installSystemApi(context);
  await ready(page, '/admin/system/users/worker');
  await page.screenshot({ path: testInfo.outputPath('user-profile.png'), fullPage: true });
  await expect(page.locator('#user-email')).toBeDisabled();
  await page.getByLabel('Họ *', { exact: true }).fill('Tên hồ sơ đang chỉnh sửa');
  await page.getByLabel('Số điện thoại', { exact: true }).fill('');
  await page.getByLabel('Ảnh đại diện mới', { exact: true }).setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from('fixture-image'),
  });
  api.failNextUserMutation(409);
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('tải lại để đối chiếu');
  await expect(page.locator('#user-first-name')).toHaveValue('Tên hồ sơ đang chỉnh sửa');
  await expect(page.getByText('Đã chọn: avatar.png', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Bỏ thay đổi người dùng?', exact: true });
  await expect(confirmation).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('user-conflict-confirmation.png'),
    fullPage: true,
  });
  await confirmation.getByRole('button', { name: 'Ở lại', exact: true }).click();
  await expect(page.locator('#user-first-name')).toHaveValue('Tên hồ sơ đang chỉnh sửa');
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu');
  const write = api.writes.filter((request) => request.path === 'users/worker').at(-1);
  expect(write?.body['Version']).toBe('u1');
  expect(write?.body['Image']).toBe('avatar.png');
  expect(api.users[0]?.phoneNumber).toBeNull();
  expect(api.users[0]?.imageUrl).toBe('/uploads/avatar.png');
  await expect(page.getByRole('button', { name: 'Lưu hồ sơ', exact: true })).toBeDisabled();
});

test('system users: status, roles and reset keep an independent profile draft', async ({
  page,
  context,
}, testInfo) => {
  const api = await installSystemApi(context);
  await ready(page, '/admin/system/users/worker');
  await page.getByLabel('Họ *', { exact: true }).fill('Hồ sơ chưa lưu');
  await page.getByRole('button', { name: 'Vô hiệu hóa tài khoản', exact: true }).click();
  const action = page.getByRole('dialog', { name: 'Xác nhận thao tác', exact: true });
  await expect(action).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('user-status-dialog.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(action).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Vô hiệu hóa tài khoản', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Vô hiệu hóa tài khoản', exact: true }).click();
  await action.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Kích hoạt tài khoản', exact: true }),
  ).toBeVisible();
  await expect(page.locator('#user-first-name')).toHaveValue('Hồ sơ chưa lưu');
  const statusVersion = api.users[0]?.version;
  expect(api.writes.find((write) => write.path.endsWith('/toggle-status'))?.body).toMatchObject({
    version: 'u1',
    activateUser: false,
    userId: 'worker',
  });
  await page.getByRole('button', { name: 'Vai trò được gán', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Nhân viên nội dung', exact: false }).uncheck();
  await page.getByRole('button', { name: 'Lưu vai trò', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu vai trò');
  expect(api.writes.find((write) => write.path === 'users/worker/roles')?.body['version']).toBe(
    statusVersion,
  );
  await page.getByRole('button', { name: /^Thông tin tài khoản/u }).click();
  await expect(page.locator('#user-first-name')).toHaveValue('Hồ sơ chưa lưu');
  await page.getByRole('button', { name: 'Gửi link đặt lại mật khẩu', exact: true }).click();
  await action.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã yêu cầu gửi liên kết đặt lại mật khẩu.');
  await expect(page.locator('#user-first-name')).toHaveValue('Hồ sơ chưa lưu');
  expect(api.writes.filter((write) => write.path.endsWith('/password-reset'))).toHaveLength(1);
  await page.getByRole('link', { name: 'Quay lại', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Bỏ thay đổi người dùng?', exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Ở lại', exact: true }).click();
  await expect(page.locator('#user-first-name')).toHaveValue('Hồ sơ chưa lưu');
});

test('system users: view-only access disables writes and prevents a create URL', async ({
  page,
  context,
}) => {
  const api = await installSystemApi(context);
  api.setUserPermissions(['View']);
  await ready(page, '/admin/system/users/worker');
  await expect(page.locator('#user-first-name')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Lưu hồ sơ', exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Vô hiệu hóa tài khoản', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Gửi link đặt lại mật khẩu', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Vai trò được gán', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Nhân viên nội dung', exact: false }),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Lưu vai trò', exact: true })).toBeDisabled();
  await page.goto('/admin/system/users/new');
  await expect(page).toHaveURL(/\/admin\/forbidden$/u);
  expect(
    api.writes.filter((write) => write.path.startsWith('users/') && write.path !== 'users/search'),
  ).toHaveLength(0);
});

test('system: group dialog inherits theme, saves API data and closes with the keyboard', async ({
  page,
  context,
}, testInfo) => {
  const api = await installSystemApi(context);
  await ready(page, '/admin/system/functions');
  await page.getByRole('button', { name: 'Quản lý nhóm', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nhóm chức năng', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Mã nhóm', { exact: false }).fill('Finance');
  await dialog.getByLabel('Tên nhóm', { exact: false }).fill('Tài chính');
  await dialog.getByRole('button', { name: 'Lưu nhóm', exact: true }).click();
  await expect(dialog.getByRole('button', { name: /Tài chính/u })).toBeVisible();
  expect(api.groups.some((g) => g.code === 'Finance')).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('function-groups.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('system: a permission string alone cannot open a central administration URL', async ({
  page,
  context,
}) => {
  await installSystemApi(context, false);
  await page.goto('/admin/system/roles');
  await finishSignIn(page);
  await expect(page).toHaveURL(/\/admin\/forbidden$/u);
  await expect(
    page.getByRole('navigation', { name: 'Quản trị hệ thống', exact: true }),
  ).toHaveCount(0);
});

test('system: function metadata and action mapping save separately and codes stay immutable', async ({
  page,
  context,
}) => {
  const api = await installSystemApi(context);
  await ready(page, '/admin/system/functions');
  await page.getByRole('link', { name: 'Thêm chức năng', exact: true }).click();
  await page.getByLabel('Mã', { exact: false }).fill('ReviewWorkflow');
  await page.getByLabel('Tên', { exact: false }).fill('Quy trình đánh giá');
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
  await expect(page).toHaveURL(/\/functions\/function-\d+$/u);
  await expect(page.locator('#capability-code')).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Phê duyệt', exact: true }).check();
  await page.locator('#capability-name').fill('Tên chưa lưu');
  await page.getByRole('button', { name: 'Lưu cấu hình hành động', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu');
  await expect(page.locator('#capability-name')).toHaveValue('Tên chưa lưu');
  expect(
    api.writes.find((w) => /functions\/function-\d+\/actions$/u.test(w.path))?.body[
      'activeActionIds'
    ],
  ).toEqual(['approve']);
  expect(api.writes.filter((w) => /^functions\/function-\d+$/u.test(w.path))).toHaveLength(0);
  await page.getByRole('link', { name: 'Hành động', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Bỏ thay đổi danh mục?', exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Bỏ thay đổi', exact: true }).click();
  await page.getByRole('link', { name: 'Thêm hành động', exact: true }).click();
  await page.locator('#capability-code').fill('CustomReview');
  await page.locator('#capability-name').fill('Đánh giá tùy chỉnh');
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
  await expect(page).toHaveURL(/\/actions\/action-\d+$/u);
  await expect(page.locator('#capability-code')).toBeDisabled();
});
