import type { BrowserContext } from '@playwright/test';
import type {
  OverviewFinance,
  OverviewStockItem,
  OverviewWork,
} from '../../src/app/modules/overview/models/overview.dto';
import { ProductFulfillmentKind } from '../../src/app/modules/ordering/models/order.dto';
import { ORDER_ID } from './orders-api';
import { PENDING_RENEWAL_ID, RENEWAL_ID } from './renewals-api';

export const OVERVIEW_GRANTS = [
  'Order',
  'Renewal',
  'Inventory',
  'DigitalInventory',
  'FinancialSummary',
  'Product',
].map((code) => `Permissions.${code}.View`);
export const OVERVIEW_PATH = '/admin/overview?from=2026-10-19&to=2026-10-25';
const generatedAtUtc = '2026-10-25T04:00:00Z';

export async function installOverviewApi(
  context: BrowserContext,
  options: { largeMoney?: boolean; empty?: boolean } = {},
) {
  const reads: string[] = [];
  const failures = new Map<string, number>();
  const work: OverviewWork = {
    generatedAtUtc,
    groups: [
      { key: 'awaiting-payment', kind: 'order', total: 0, items: [] },
      {
        key: 'awaiting-processing',
        kind: 'order',
        total: options.empty ? 0 : 1,
        items: options.empty
          ? []
          : [
              {
                id: ORDER_ID,
                orderId: ORDER_ID,
                orderNumber: 'ORD-001',
                name: null,
                sku: null,
                status: 2,
                createdAtUtc: '2026-10-21T00:00:00Z',
              },
            ],
      },
      { key: 'needs-review', kind: 'order', total: 0, items: [] },
      {
        key: 'renewal-awaiting-work',
        kind: 'renewal',
        total: options.empty ? 0 : 2,
        items: options.empty
          ? []
          : [
              {
                id: RENEWAL_ID,
                orderId: 'order-a',
                orderNumber: 'ORD-002',
                name: 'Gia hạn Pro dành cho nhóm vận hành có tên tiếng Việt dài',
                sku: 'PRO-1',
                status: 2,
                createdAtUtc: '2026-10-20T03:00:00Z',
              },
            ],
      },
      {
        key: 'renewal-pending-verification',
        kind: 'renewal',
        total: options.empty ? 0 : 1,
        items: options.empty
          ? []
          : [
              {
                id: PENDING_RENEWAL_ID,
                orderId: 'order-a',
                orderNumber: 'ORD-003',
                name: 'Gia hạn chờ xác minh',
                sku: 'PRO-3',
                status: 4,
                createdAtUtc: '2026-10-21T08:00:00Z',
              },
            ],
      },
    ],
  };
  const inventory: OverviewStockItem[] = Array.from(
    { length: options.empty ? 0 : 13 },
    (_, index) => ({
      productId: '30000000-0000-0000-0000-000000000001',
      variantId: `40000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
      productName:
        index === 0
          ? 'Túi Everyday Tote phiên bản giới hạn dành cho cửa hàng'
          : `Sản phẩm cần bổ sung ${index + 1}`,
      sku: `OV-STOCK-${String(index + 1).padStart(2, '0')}`,
      fulfillmentKind:
        index === 1
          ? ProductFulfillmentKind.DigitalUnique
          : index === 2
            ? ProductFulfillmentKind.DigitalShared
            : ProductFulfillmentKind.Physical,
      available: index < 3 ? 0 : index % 6,
    }),
  );
  await context.route('**/api/admin/overview/**', async (route) => {
    const url = new URL(route.request().url());
    const section = url.pathname.split('/').at(-1)!;
    reads.push(`${url.pathname}${url.search}`);
    const status = failures.get(section);
    if (status) {
      failures.delete(section);
      return route.fulfill({
        status,
        json: { status, detail: 'Chưa thể tải phần tổng quan này.' },
      });
    }
    if (section === 'work') return route.fulfill({ json: work });
    if (section === 'finance') {
      const from = url.searchParams.get('from')!;
      const to = url.searchParams.get('to')!;
      const days = [];
      for (
        let date = new Date(`${from}T00:00:00Z`);
        date.toISOString().slice(0, 10) <= to;
        date = new Date(date.getTime() + 86_400_000)
      ) {
        const first = days.length === 0 && !options.empty;
        days.push({
          date: date.toISOString().slice(0, 10),
          received: first ? (options.largeMoney ? '9007199254740993' : '1500000') : '0',
          refunded: first ? (options.largeMoney ? '9007199254741000' : '1750000') : '0',
          net: first ? (options.largeMoney ? '-7' : '-250000') : '0',
        });
      }
      const finance: OverviewFinance = {
        generatedAtUtc,
        from,
        to,
        timeZone: 'Asia/Ho_Chi_Minh',
        currency: 'VND',
        received: days[0]?.received ?? '0',
        refunded: days[0]?.refunded ?? '0',
        net: days[0]?.net ?? '0',
        days,
      };
      return route.fulfill({ json: finance });
    }
    if (section === 'stock') {
      const threshold = Number(url.searchParams.get('threshold'));
      const pageNumber = Number(url.searchParams.get('page'));
      const pageSize = Number(url.searchParams.get('size'));
      const filtered = inventory.filter((item) => item.available <= threshold);
      return route.fulfill({
        json: {
          generatedAtUtc,
          threshold,
          pageNumber,
          pageSize,
          total: filtered.length,
          items: filtered.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
        },
      });
    }
    return route.fulfill({ status: 404 });
  });
  return {
    reads,
    failNext: (section: 'work' | 'finance' | 'stock', status = 503) =>
      failures.set(section, status),
  };
}
