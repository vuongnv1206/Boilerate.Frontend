import type { BrowserContext } from '@playwright/test';
import { expect, ready, test } from './helpers/catalog-api';

const id = '70000000-0000-0000-0000-000000000001';
const createGrants = ['View', 'Create', 'Update'].map((action) => `Permissions.Discount.${action}`);

async function installDiscountApi(context: BrowserContext) {
  let record = {
    id,
    code: 'SALE10',
    name: 'Ưu đãi tháng mới',
    kind: 1,
    value: 10,
    minimumSubtotal: 0,
    startsAtUtc: null,
    endsAtUtc: null,
    usageLimit: 8,
    usedCount: 2,
    isActive: true,
    version: 'version-1',
  };
  let conflict = false;
  const writes: Record<string, unknown>[] = [];
  await context.route('**/api/admin/discounts**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname.endsWith('/discounts')) {
      const term = url.searchParams.get('search')?.toUpperCase() ?? '';
      const active = url.searchParams.get('isActive');
      const included =
        (!term || record.code.includes(term) || record.name.toUpperCase().includes(term)) &&
        (active === null || record.isActive === (active === 'true'));
      return route.fulfill({
        json: {
          items: included ? [record] : [],
          total: included ? 1 : 0,
          pageNumber: 1,
          pageSize: 20,
        },
      });
    }
    if (request.method() === 'GET') return route.fulfill({ json: record });
    if (request.method() === 'PUT' || request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      writes.push(body);
      if (conflict) {
        conflict = false;
        return route.fulfill({ status: 409, json: { status: 409, title: 'Conflict' } });
      }
      record = {
        ...record,
        ...body,
        id,
        usedCount: record.usedCount,
        version: 'version-2',
      } as typeof record;
      return route.fulfill({ json: record });
    }
    return route.fulfill({ status: 405 });
  });
  return { writes, conflictNext: () => (conflict = true) };
}

test('discount admin: filters persist and creation uses Vietnamese time', async ({
  page,
  context,
  catalog,
}, testInfo) => {
  catalog.setPermissions(createGrants);
  const api = await installDiscountApi(context);
  await ready(page, '/admin/discounts?active=true&q=SALE');
  await expect(page.getByRole('link', { name: /SALE10/u })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('discount-list.png') });
  await page.getByRole('link', { name: 'Tạo mã', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mã giảm giá mới' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Mã giảm giá', exact: true }).fill('hello10');
  await page.getByRole('textbox', { name: 'Tên mã', exact: true }).fill('Ưu đãi tiếng Việt dài');
  await page.getByRole('spinbutton', { name: 'Mức giảm (%)', exact: true }).fill('10');
  await expect(page.getByRole('combobox', { name: 'Loại giảm', exact: true })).toBeVisible();
  await page.getByLabel('Bắt đầu', { exact: true }).fill('2026-11-02T08:30');
  await page.getByLabel('Kết thúc', { exact: true }).fill('2026-11-03T08:30');
  await page.screenshot({ path: testInfo.outputPath('discount-editor.png') });
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/discounts/${id}\\?active=true&q=SALE$`, 'u'));
  expect(api.writes).toHaveLength(1);
  expect(api.writes[0]).toMatchObject({
    code: 'HELLO10',
    name: 'Ưu đãi tiếng Việt dài',
    value: 10,
    startsAtUtc: '2026-11-02T01:30:00.000Z',
    endsAtUtc: '2026-11-03T01:30:00.000Z',
  });
  await page.getByRole('link', { name: 'Quay lại danh sách mã giảm giá' }).click();
  await expect(page).toHaveURL(/\/admin\/discounts\?active=true&q=SALE$/u);
});

test('discount admin: conflict keeps draft and view-only permission prevents writes', async ({
  page,
  context,
  catalog,
}) => {
  catalog.setPermissions(createGrants);
  const api = await installDiscountApi(context);
  await ready(page, `/admin/discounts/${id}`);
  await page.getByRole('textbox', { name: 'Tên mã', exact: true }).fill('Tên đang chỉnh sửa');
  api.conflictNext();
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Bản nhập được giữ lại');
  await expect(page.getByRole('textbox', { name: 'Tên mã', exact: true })).toHaveValue(
    'Tên đang chỉnh sửa',
  );
  await page.getByRole('link', { name: 'Quay lại danh sách mã giảm giá' }).click();
  await expect(page.getByRole('dialog', { name: 'Rời khỏi mã giảm giá?' })).toBeVisible();
  await page.getByRole('button', { name: 'Ở lại', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Tên mã', exact: true })).toHaveValue(
    'Tên đang chỉnh sửa',
  );
  expect(api.writes).toHaveLength(1);

  catalog.setPermissions(['Permissions.Discount.View']);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Tên mã', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toHaveCount(0);
  await expect(page.getByText('Chỉ xem', { exact: true })).toBeVisible();
  expect(api.writes).toHaveLength(1);
});
