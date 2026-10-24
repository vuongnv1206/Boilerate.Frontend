import { test, expect, ready } from './helpers/catalog-api';
import {
  installRenewalsApi,
  PENDING_RENEWAL_ID,
  RENEWAL_GRANTS,
  RENEWAL_ID,
  SECOND_RENEWAL_ID,
} from './helpers/renewals-api';

test('renewals: command updates detail, rail and history; lost response replays one start', async ({
  page,
  context,
  catalog,
}, testInfo) => {
  catalog.setPermissions(RENEWAL_GRANTS);
  const api = await installRenewalsApi(context);
  await ready(page, `/admin/renewals/${RENEWAL_ID}`);
  await page.getByRole('button', { name: 'Nhận xử lý', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bắt đầu gia hạn', exact: true })).toBeEnabled();
  await expect(page.locator('.renewal-history-table')).toContainText('claim');
  const tablet = testInfo.project.name.startsWith('tablet');
  if (tablet) await page.getByRole('button', { name: 'Yêu cầu gia hạn', exact: true }).click();
  const rail = page.getByRole('navigation', { name: 'Yêu cầu trong trang hiện tại' });
  await expect(rail.getByRole('link').filter({ hasText: 'Gia hạn Pro' })).toContainText(
    'Đang xử lý',
  );
  if (tablet) await page.keyboard.press('Escape');
  api.loseNextStartResponse();
  await page.getByRole('button', { name: 'Bắt đầu gia hạn', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Thử lại đúng yêu cầu', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Thử lại đúng yêu cầu', exact: true }).click();
  await expect(page.locator('.renewal-verify-form')).toBeVisible();
  expect(api.writes.filter((write) => write.path.endsWith('/start'))).toHaveLength(2);
  expect(api.writes[2]?.body).toEqual(api.writes[1]?.body);
  expect(api.records[0]?.attempts).toHaveLength(1);
  await expect(page.locator('.renewal-history-table tbody tr')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Nhận xử lý', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bắt đầu gia hạn', exact: true })).toHaveCount(0);
});

test('renewals: verify conflict retains input, history failure retries reads and filtered rail becomes canonical', async ({
  page,
  context,
  catalog,
}, testInfo) => {
  catalog.setPermissions(RENEWAL_GRANTS);
  const api = await installRenewalsApi(context);
  api.conflictNextVerify();
  await ready(page, `/admin/renewals/${PENDING_RENEWAL_ID}?status=4`);
  await page.getByLabel('Gia hạn đã được áp dụng').uncheck();
  await page.getByLabel('Ghi chú xác minh', { exact: true }).fill('Đã kiểm tra, chưa được áp dụng');
  await page.getByLabel('Bằng chứng (tùy chọn)', { exact: true }).fill('Bằng chứng bản nhập');
  await page.getByRole('button', { name: 'Lưu kết quả xác minh', exact: true }).click();
  await expect(page.getByLabel('Ghi chú xác minh', { exact: true })).toHaveValue(
    'Đã kiểm tra, chưa được áp dụng',
  );
  await page.getByRole('link', { name: 'Quay lại gia hạn', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Ở lại', exact: true }).click();
  api.failNextHistory();
  await page.getByRole('button', { name: 'Lưu kết quả xác minh', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nhận xử lý', exact: true })).toBeEnabled();
  await expect(page.locator('.renewal-history-card')).toContainText('Thao tác đã lưu');
  await page.getByRole('button', { name: 'Tải lại lịch sử', exact: true }).click();
  await expect(page.locator('.renewal-history-table')).toContainText('verify');
  expect(api.writes).toHaveLength(2);
  expect(api.writes[1]?.body['operationId']).not.toBe(api.writes[0]?.body['operationId']);
  if (testInfo.project.name.startsWith('tablet'))
    await page.getByRole('button', { name: 'Yêu cầu gia hạn', exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: 'Yêu cầu trong trang hiện tại' }).getByRole('link'),
  ).toHaveCount(0);
});

test('renewals: query, switching records and tablet focus preserve context and clear revealed content', async ({
  page,
  context,
  catalog,
}, testInfo) => {
  catalog.setPermissions(RENEWAL_GRANTS);
  const api = await installRenewalsApi(context);
  await ready(page, `/admin/renewals/${RENEWAL_ID}?status=2`);
  await page.getByRole('button', { name: 'Xem thông tin đầy đủ', exact: true }).click();
  await expect(page.locator('.renewal-revealed-value')).toContainText(
    `account-secret-${RENEWAL_ID}`,
  );
  const toggle = page.getByRole('button', { name: 'Yêu cầu gia hạn', exact: true });
  const tablet = testInfo.project.name.startsWith('tablet');
  if (tablet) {
    await toggle.click();
    await expect(page.locator('#renewal-items')).toHaveAttribute('role', 'dialog');
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await toggle.click();
  }
  await page
    .getByRole('navigation', { name: 'Yêu cầu trong trang hiện tại' })
    .getByRole('link')
    .filter({ hasText: 'Gia hạn Team' })
    .click();
  await expect(page).toHaveURL(`/admin/renewals/${SECOND_RENEWAL_ID}?status=2`);
  await expect(page.locator('.renewal-revealed-value')).toHaveCount(0);
  await page.getByRole('link', { name: 'Quay lại gia hạn', exact: true }).click();
  await expect(page).toHaveURL('/admin/renewals?status=2');
  await page.goBack();
  await expect(page).toHaveURL(`/admin/renewals/${SECOND_RENEWAL_ID}?status=2`);
  expect(api.reads.filter((path) => path.endsWith('/target'))).toHaveLength(1);
});

test('renewals: view-only permissions hide commands and sensitive reads', async ({
  page,
  context,
  catalog,
}) => {
  catalog.setPermissions(['Permissions.Renewal.View']);
  const api = await installRenewalsApi(context);
  await ready(page, `/admin/renewals/${PENDING_RENEWAL_ID}`);
  await expect(page.locator('.renewal-verify-form')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xem thông tin đầy đủ', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'Xem bằng chứng', exact: true })).toHaveCount(0);
  expect(api.writes).toEqual([]);
  expect(api.reads.some((path) => /\/(target|evidence)$/u.test(path))).toBe(false);
});
