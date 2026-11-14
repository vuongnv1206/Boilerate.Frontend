import {
  ORDER_STATUS_LABELS,
  OrderFulfillmentStatus,
  OrderListQuery,
  OrderPaymentStatus,
  OrderQueue,
  OrderStatus,
} from './order.dto';

type OrderBadgeTone = 'success' | 'warning' | 'neutral' | 'muted';

export function orderStatusTone(status: OrderStatus): OrderBadgeTone {
  if (status === OrderStatus.Completed) return 'success';
  if (status === OrderStatus.PendingPayment) return 'warning';
  if (status === OrderStatus.Cancelled || status === OrderStatus.Expired) return 'muted';
  return 'neutral';
}

export function customerOrderStatusLabel(status: OrderStatus): string {
  if (status === OrderStatus.Expired) return 'Đã hết hạn';
  return ORDER_STATUS_LABELS[status] ?? 'Đang xử lý';
}

export function customerOrderDetailFulfillmentLabel(status: OrderFulfillmentStatus): string {
  switch (status) {
    case OrderFulfillmentStatus.Pending:
      return 'Chờ giao hàng';
    case OrderFulfillmentStatus.InProgress:
      return 'Đang vận chuyển';
    case OrderFulfillmentStatus.Completed:
      return 'Đã hoàn tất';
    // Internal review is the shop's business; the customer only needs to know it is in progress.
    case OrderFulfillmentStatus.NeedsReview:
      return 'Đang xử lý';
    case OrderFulfillmentStatus.Stopped:
      return 'Đã dừng';
    default:
      return 'Chờ xử lý';
  }
}

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
    queue:
      typeof values['queue'] === 'string' &&
      ['awaiting-payment', 'awaiting-processing', 'needs-review'].includes(values['queue'])
        ? (values['queue'] as OrderQueue)
        : null,
    q: typeof values['q'] === 'string' ? values['q'].trim() : '',
    status: enumValue<OrderStatus>(values['status'], [1, 2, 3, 4, 5, 6]),
    paymentStatus: enumValue<OrderPaymentStatus>(values['paymentStatus'], [1, 2]),
    fulfillmentStatus: enumValue<OrderFulfillmentStatus>(
      values['fulfillmentStatus'],
      [1, 2, 3, 4, 5],
    ),
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
    ...(query.queue ? { queue: query.queue } : {}),
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
