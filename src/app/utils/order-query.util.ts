import {
  OrderFulfillmentStatus,
  OrderListQuery,
  OrderPaymentStatus,
  OrderStatus,
} from '@models/order.dto';

type QueryValues = Readonly<Record<string, unknown>>;

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function enumValue<T extends number>(value: unknown, allowed: readonly T[]): T | null {
  const parsed = positiveInteger(value, 0) as T;
  return allowed.includes(parsed) ? parsed : null;
}

function dateValue(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : '';
}

export function readOrderListQuery(values: QueryValues): OrderListQuery {
  return {
    q: typeof values['q'] === 'string' ? values['q'].trim() : '',
    status: enumValue(values['status'], [1, 2, 3, 4, 5, 6]),
    paymentStatus: enumValue(values['paymentStatus'], [1, 2]),
    fulfillmentStatus: enumValue(values['fulfillmentStatus'], [1, 2, 3, 4, 5]),
    createdFrom: dateValue(values['createdFrom']),
    createdTo: dateValue(values['createdTo']),
    page: positiveInteger(values['page'], 1),
    pageSize: [10, 20, 50].includes(positiveInteger(values['pageSize'], 10))
      ? positiveInteger(values['pageSize'], 10)
      : 10,
  };
}

export function orderListQueryParams(query: OrderListQuery): Record<string, string | number> {
  return {
    ...(query.q ? { q: query.q } : {}),
    ...(query.status === null ? {} : { status: query.status }),
    ...(query.paymentStatus === null ? {} : { paymentStatus: query.paymentStatus }),
    ...(query.fulfillmentStatus === null ? {} : { fulfillmentStatus: query.fulfillmentStatus }),
    ...(query.createdFrom ? { createdFrom: query.createdFrom } : {}),
    ...(query.createdTo ? { createdTo: query.createdTo } : {}),
    ...(query.page > 1 ? { page: query.page } : {}),
    ...(query.pageSize !== 10 ? { pageSize: query.pageSize } : {}),
  };
}

export function sameOrderQueryParams(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean {
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => String(left[key]) === String(right[key]))
  );
}

export type { OrderStatus, OrderPaymentStatus, OrderFulfillmentStatus };
