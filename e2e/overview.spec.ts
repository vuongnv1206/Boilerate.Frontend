import { test, expect, ready, finishSignIn } from './helpers/catalog-api';
import { installOverviewApi, OVERVIEW_GRANTS, OVERVIEW_PATH } from './helpers/overview-api';
import { installOrdersApi } from './helpers/orders-api';
import { installRenewalsApi, PENDING_RENEWAL_ID } from './helpers/renewals-api';
import type { Page } from '@playwright/test';

test.beforeEach(async ({ page, catalog }) => {
  catalog.setPermissions(OVERVIEW_GRANTS);
  await page.clock.setFixedTime(new Date('2026-10-25T04:00:00Z'));
});

test('overview: current queues, Vietnamese dates, negative net and stock retain their own contexts', async ({
  page,
  context,
}, testInfo) => {
  const api = await installOverviewApi(context);
  await ready(page, OVERVIEW_PATH);
  await expect(page.locator('.overview-work-group')).toHaveCount(5);
  await page.getByRole('button', { name: /Đơn chờ hoàn tất/u }).click();
  await expect(page.getByTestId('overview-net')).toContainText('-250.000');
  await expect(
    page.getByRole('img', { name: 'Tiền đã nhận, đã hoàn và thu ròng theo ngày' }),
  ).toBeAttached();
  await expect(page.locator('.overview-pagination')).toContainText('13 SKU');
  const workScreenshot = await page.screenshot({
    path: testInfo.outputPath('admin-overview-work.png'),
    animations: 'disabled',
    caret: 'hide',
  });
  await alignOverviewSection(page, 'overview-finance-title');
  await expect(page.locator('.overview-finance-chart svg')).toBeInViewport({ ratio: 0.5 });
  const financeScreenshot = await page.screenshot({
    path: testInfo.outputPath('admin-overview-finance.png'),
    animations: 'disabled',
    caret: 'hide',
  });
  await alignOverviewSection(page, 'overview-stock-title');
  const stockScreenshot = await page.screenshot({
    path: testInfo.outputPath('admin-overview-stock.png'),
    animations: 'disabled',
    caret: 'hide',
  });
  await page.getByRole('button', { name: 'Trang cảnh báo sau', exact: true }).click();
  await expect(page).toHaveURL(/page=2/u);
  await expect(page.locator('.overview-pagination')).toContainText('11–13');
  await page.getByLabel('Ngưỡng cảnh báo', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Áp dụng ngưỡng', exact: true }).click();
  await expect(page).toHaveURL(/threshold=0/u);
  await expect(page).not.toHaveURL(/page=2/u);
  await expect(page.locator('.overview-pagination')).toContainText('5 SKU');
  expect(api.reads.filter((path) => path.includes('/finance'))).toHaveLength(1);
  expect(api.reads.filter((path) => path.includes('/work'))).toHaveLength(1);
  await page.getByRole('button', { name: 'Hiện bảng số liệu theo ngày', exact: true }).click();
  await expect(page.locator('#overview-daily-data tbody tr')).toHaveCount(7);
  await expect(page.locator('#overview-daily-data tbody tr').first()).toContainText('19/10/2026');
  await expect(page.locator('#overview-daily-data tbody tr').last()).toContainText('0');
  await page.locator('#overview-range').click();
  const dateOptions = page.getByRole('listbox', { name: 'Danh sách lựa chọn', exact: true });
  await expect(dateOptions).toBeVisible();
  expect(await dateOptions.evaluate((element) => element.closest('.workspace') === null)).toBe(
    true,
  );
  await page.getByRole('option', { name: 'Hôm nay', exact: true }).click();
  await expect(page).toHaveURL(/from=2026-10-25&to=2026-10-25/u);
  await expect(page.locator('#overview-daily-data tbody tr')).toHaveCount(1);
  expect(api.reads.filter((path) => path.includes('/work'))).toHaveLength(1);
  expect
    .soft(workScreenshot)
    .toMatchSnapshot('admin-overview-work.png', { maxDiffPixelRatio: 0.002 });
  expect
    .soft(financeScreenshot)
    .toMatchSnapshot('admin-overview-finance.png', { maxDiffPixelRatio: 0.002 });
  expect
    .soft(stockScreenshot)
    .toMatchSnapshot('admin-overview-stock.png', { maxDiffPixelRatio: 0.002 });
});

async function alignOverviewSection(page: Page, titleId: string): Promise<void> {
  await page.locator('.overview-scroll').evaluate((scroller, id) => {
    const section = scroller.querySelector(`#${id}`)?.closest('.overview-section');
    if (!section) throw new Error(`Overview section ${id} is missing.`);
    scroller.scrollTop +=
      section.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  }, titleId);
}

test('overview: queue links preserve filters through details, Back and removable chips', async ({
  page,
  context,
}) => {
  await installOverviewApi(context);
  await installOrdersApi(context);
  await installRenewalsApi(context);
  await ready(page, OVERVIEW_PATH);
  await page.getByRole('button', { name: /Đơn chờ hoàn tất/u }).click();
  await page.getByRole('link', { name: 'Xem tất cả', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/orders\?queue=awaiting-processing$/u);
  await expect(page.locator('.collection-queue-filter')).toContainText('Đơn chờ hoàn tất');
  await page.locator('.order-table tbody a').first().click();
  await expect(page).toHaveURL(/queue=awaiting-processing/u);
  await page.getByRole('link', { name: 'Quay lại đơn hàng', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/orders\?queue=awaiting-processing$/u);
  await page.locator('.collection-queue-filter button').click();
  await expect(page).toHaveURL(/\/admin\/orders$/u);
  await page.goBack();
  await expect(page).toHaveURL(/queue=awaiting-processing/u);
  await page.goto(OVERVIEW_PATH);
  await page.getByRole('button', { name: /Gia hạn chờ xác minh/u }).click();
  await page.getByRole('link', { name: 'Xem tất cả', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/renewals\?queue=pending-verification$/u);
  await expect(page.locator('.renewal-table tbody tr')).toHaveCount(1);
  await page.locator(`a[href*="${PENDING_RENEWAL_ID}"]`).first().click();
  await expect(page).toHaveURL(/queue=pending-verification/u);
  await page.getByRole('link', { name: 'Quay lại gia hạn', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/renewals\?queue=pending-verification$/u);
  await page.locator('.collection-queue-filter button').click();
  await expect(page).toHaveURL(/\/admin\/renewals$/u);
  await page.goto('/admin/renewals?queue=unknown&page=0&extra=discard');
  await expect(page).toHaveURL(/\/admin\/renewals$/u);
  await expect(page.locator('.renewal-table tbody tr')).toHaveCount(3);
});

test('overview: independent failures retry without losing healthy sections and revoked finance is cleared', async ({
  page,
  context,
}) => {
  const api = await installOverviewApi(context);
  api.failNext('finance');
  await ready(page, OVERVIEW_PATH);
  await expect(
    page.getByRole('button', { name: 'Thử lại số liệu thu tiền', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.overview-work-group')).toHaveCount(5);
  await expect(page.locator('.overview-pagination')).toContainText('13 SKU');
  await page.getByRole('button', { name: 'Thử lại số liệu thu tiền', exact: true }).click();
  await expect(page.getByTestId('overview-received')).toContainText('1.500.000');
  api.failNext('finance', 403);
  await page.getByRole('button', { name: 'Tải lại số liệu thu tiền', exact: true }).click();
  await expect(page.locator('#overview-finance-title')).toHaveCount(0);
  await expect(page.getByTestId('overview-received')).toHaveCount(0);
  await expect(page.locator('.overview-work-group')).toHaveCount(5);
  await expect(page.locator('.overview-pagination')).toContainText('13 SKU');
});

test('overview: finance-only account opens admin home without forbidden requests and keeps exact VND', async ({
  page,
  context,
  catalog,
}) => {
  catalog.setPermissions(['Permissions.FinancialSummary.View']);
  const api = await installOverviewApi(context, { largeMoney: true });
  await page.goto('/admin');
  await finishSignIn(page);
  await expect(page).toHaveURL(new RegExp(OVERVIEW_PATH.replace('?', '\\?'), 'u'));
  await expect(page.getByTestId('overview-received')).toContainText('9.007.199.254.740.993');
  await expect(page.getByTestId('overview-net')).toContainText('-7');
  await expect(page.locator('#overview-work-title')).toHaveCount(0);
  await expect(page.locator('#overview-stock-title')).toHaveCount(0);
  expect(api.reads.every((path) => path.includes('/finance'))).toBe(true);
  await page.getByRole('button', { name: 'Hiện bảng số liệu theo ngày', exact: true }).click();
  await expect(page.locator('#overview-daily-data')).toContainText('9.007.199.254.740.993');
  await page.reload();
  await expect(page.getByTestId('overview-received')).toContainText('9.007.199.254.740.993');
});

test('overview: empty current data has distinct messages and an all-zero daily table', async ({
  page,
  context,
}) => {
  await installOverviewApi(context, { empty: true });
  await ready(page, OVERVIEW_PATH);
  await expect(page.getByText('Không có việc trong nhóm này', { exact: true })).toBeVisible();
  await expect(page.getByText('Không có SKU cần cảnh báo', { exact: true })).toBeAttached();
  await expect(page.getByRole('status')).toContainText(
    'Không phát sinh nhận hoặc hoàn tiền trong khoảng ngày này.',
  );
  await page.getByRole('button', { name: 'Hiện bảng số liệu theo ngày', exact: true }).click();
  await expect(page.locator('#overview-daily-data tbody tr')).toHaveCount(7);
  await expect(page.getByTestId('overview-net')).toContainText('0');
});

test('overview: custom dates and threshold validation preserve URL state on reload and browser Back', async ({
  page,
  context,
}, testInfo) => {
  const api = await installOverviewApi(context);
  const path = '/admin/overview?from=2026-10-01&to=2026-10-02&threshold=0';
  await ready(page, path);
  await expect(page.locator('#overview-range')).toContainText('Tùy chọn');
  const fromDate = page.getByRole('combobox', { name: 'Từ ngày', exact: true });
  await fromDate.click();
  const datePopup = page.getByRole('dialog');
  await expect(datePopup).toBeVisible();
  expect(await datePopup.evaluate((element) => element.closest('.workspace') === null)).toBe(true);
  expect(await datePopup.evaluate((element) => element.closest('.app-dark') !== null)).toBe(
    testInfo.project.name.endsWith('-dark'),
  );
  await page.keyboard.press('Escape');
  await expect(datePopup).not.toBeVisible();
  await expect(fromDate).toBeFocused();
  await expect(page.getByLabel('Ngưỡng cảnh báo', { exact: true })).toHaveValue('0');
  await page.getByLabel('Ngưỡng cảnh báo', { exact: true }).fill('1000');
  await expect(page.getByRole('button', { name: 'Áp dụng ngưỡng', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Nhập số nguyên từ 0 đến 999');
  expect(api.reads.filter((request) => request.includes('/stock'))).toHaveLength(1);
  await page.reload();
  await expect(page.getByLabel('Ngưỡng cảnh báo', { exact: true })).toHaveValue('0');
  await page.locator('#overview-range').click();
  await page.getByRole('option', { name: '30 ngày', exact: true }).click();
  await expect(page).toHaveURL(/from=2026-09-26&to=2026-10-25&threshold=0/u);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(path.replace('?', '\\?'), 'u'));
  await expect(page.locator('#overview-range')).toContainText('Tùy chọn');
});
