import type {
  OverviewFinance,
  OverviewStock,
  OverviewWork,
} from '../src/app/api/overview/models/overview.dto';
import { test, expect, signIn, signInAs, apiAs } from './fixtures';

test('live overview: read-only current queues match their destination lists and finance balances daily receipts', async ({
  liveApi,
  basicApi,
}) => {
  const beforeResponse = await liveApi.get('/api/admin/orders?size=50&page=1');
  expect(beforeResponse.status()).toBe(200);
  const before = await beforeResponse.json();
  const workResponse = await liveApi.get('/api/admin/overview/work');
  expect(workResponse.status()).toBe(200);
  expect(workResponse.headers()['cache-control']).toContain('no-store');
  const work = (await workResponse.json()) as OverviewWork;
  expect(work.groups).toHaveLength(5);
  expect(work.generatedAtUtc).toMatch(/Z$/u);
  for (const group of work.groups) {
    const queue = group.key.replace(/^renewal-/u, '');
    const list = await liveApi.get(`/api/admin/${group.kind === 'order' ? 'orders' : 'renewals'}`, {
      params: { queue, page: 1, size: 50 },
    });
    expect(list.status(), group.key).toBe(200);
    const result = await list.json();
    expect(group.total, group.key).toBe(result.total);
    expect(group.items).toHaveLength(Math.min(5, group.total));
    for (const item of group.items) {
      expect(Object.keys(item).sort()).toEqual([
        'createdAtUtc',
        'id',
        'name',
        'orderId',
        'orderNumber',
        'sku',
        'status',
      ]);
      expect(
        result.items.some(
          (record: { id?: string; renewal?: { id: string } }) =>
            (record.renewal?.id ?? record.id) === item.id,
        ),
      ).toBe(true);
    }
  }
  const financeResponse = await liveApi.get('/api/admin/overview/finance');
  expect(financeResponse.status()).toBe(200);
  const finance = (await financeResponse.json()) as OverviewFinance;
  expect(finance.timeZone).toBe('Asia/Ho_Chi_Minh');
  expect(finance.days).toHaveLength(7);
  for (const key of ['received', 'refunded', 'net'] as const) {
    expect(finance[key]).toMatch(/^-?\d+$/u);
    expect(finance.days.reduce((sum, day) => sum + BigInt(day[key]), 0n).toString()).toBe(
      finance[key],
    );
  }
  expect(BigInt(finance.received) - BigInt(finance.refunded)).toBe(BigInt(finance.net));
  const stockResponse = await liveApi.get('/api/admin/overview/stock?threshold=0&page=1&size=10');
  expect(stockResponse.status()).toBe(200);
  const stock = (await stockResponse.json()) as OverviewStock;
  expect(stock.threshold).toBe(0);
  expect(stock.items.every((item) => item.available <= 0)).toBe(true);
  for (const item of stock.items)
    expect(Object.keys(item).sort()).toEqual([
      'available',
      'fulfillmentKind',
      'productId',
      'productName',
      'sku',
      'variantId',
    ]);
  const afterResponse = await liveApi.get('/api/admin/orders?size=50&page=1');
  expect(await afterResponse.json()).toEqual(before);
  for (const path of ['work', 'finance', 'stock']) {
    expect((await basicApi.get(`/api/admin/overview/${path}`)).status()).toBe(403);
  }
  expect(
    (await liveApi.get('/api/admin/overview/finance?from=2026-01-01&to=2026-04-01')).status(),
  ).toBe(400);
  expect((await liveApi.get('/api/admin/overview/stock?threshold=1000')).status()).toBe(400);
});

test('live overview: admin home and protected overview URL survive reload with independent section permissions', async ({
  page,
  live,
}) => {
  await signIn(page, live, '/admin');
  await expect(page).toHaveURL(/\/admin\/overview\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/u);
  await expect(page.locator('#overview-work-title')).toBeVisible();
  await expect(page.locator('#overview-finance-title')).toBeAttached();
  await expect(page.locator('#overview-stock-title')).toBeAttached();
  const path = new URL(page.url()).pathname + new URL(page.url()).search;
  await page.reload();
  await expect(page).toHaveURL(new RegExp(path.replace('?', '\\?'), 'u'));
  await expect(
    page.getByRole('heading', { name: 'Tổng quan vận hành', exact: true }),
  ).toBeVisible();
  await page.locator('#overview-stock-title').scrollIntoViewIfNeeded();
  await page.getByLabel('Ngưỡng cảnh báo', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Áp dụng ngưỡng', exact: true }).click();
  await expect(page).toHaveURL(/threshold=0/u);
  await page.reload();
  await expect(page.getByLabel('Ngưỡng cảnh báo', { exact: true })).toHaveValue('0');
});

test('live overview: finance-only access is independent from payment confirmation and sends no work or stock requests', async ({
  page,
  live,
  baseURL,
}) => {
  const financeActor = live.actors['financialViewer'];
  expect(financeActor).toBeTruthy();
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/admin/overview/'))
      requests.push(new URL(request.url()).pathname);
  });
  await signInAs(page, financeActor!, '/admin');
  await expect(page.getByTestId('overview-received')).toBeVisible();
  await expect(page.locator('#overview-work-title')).toHaveCount(0);
  await expect(page.locator('#overview-stock-title')).toHaveCount(0);
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every((path) => path.endsWith('/finance'))).toBe(true);
  await page.getByRole('button', { name: 'Hiện bảng số liệu theo ngày', exact: true }).click();
  await expect(page.locator('#overview-daily-data tbody tr')).toHaveCount(7);
  const financeApi = await apiAs(baseURL!, financeActor!);
  const operationsApi = await apiAs(baseURL!, live.actors['operations']!);
  try {
    expect((await financeApi.get('/api/admin/overview/finance')).status()).toBe(200);
    expect((await financeApi.get('/api/admin/overview/work')).status()).toBe(403);
    expect((await financeApi.get('/api/admin/overview/stock')).status()).toBe(403);
    expect((await operationsApi.get('/api/admin/overview/work')).status()).toBe(200);
    expect((await operationsApi.get('/api/admin/overview/finance')).status()).toBe(403);
  } finally {
    await financeApi.dispose();
    await operationsApi.dispose();
  }
});
