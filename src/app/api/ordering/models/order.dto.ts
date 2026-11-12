export enum OrderStatus {
  PendingPayment = 1,
  AwaitingProcessing = 2,
  Cancelled = 3,
  Expired = 4,
  Completed = 5,
  Closed = 6,
}

export enum OrderPaymentMethod {
  Prepaid = 1,
  CashOnDelivery = 2,
}

export enum OrderPaymentStatus {
  Unpaid = 1,
  Paid = 2,
}

export enum OrderFulfillmentStatus {
  Pending = 1,
  NeedsReview = 2,
  InProgress = 3,
  Completed = 4,
  Stopped = 5,
}

export enum ProductFulfillmentKind {
  Physical = 1,
  DigitalUnique = 2,
  DigitalShared = 3,
  ManualExtension = 4,
}

export interface OrderSummary {
  readonly id: string;
  readonly number: string;
  readonly status: OrderStatus;
  readonly paymentMethod: OrderPaymentMethod;
  readonly total: number;
  readonly currency: string;
  readonly createdOn: string;
  readonly expiresAt: string | null;
  readonly paymentStatus: OrderPaymentStatus;
  readonly fulfillmentStatus: OrderFulfillmentStatus;
  readonly paidAtUtc: string | null;
  readonly recipientName: string;
  readonly email: string;
  readonly phone: string;
}

export interface OrderPage {
  readonly items: readonly OrderSummary[];
  readonly total: number;
  readonly pageNumber: number;
  readonly pageSize: number;
}

export interface OrderLine {
  readonly id: string;
  readonly productId: string;
  readonly variantId: string;
  readonly name: string;
  readonly sku: string;
  readonly optionDescription: string;
  readonly fulfillmentKind: ProductFulfillmentKind;
  readonly unitPrice: number;
  readonly quantity: number;
}

export interface OrderDto {
  readonly id: string;
  readonly number: string;
  readonly version: string;
  readonly status: OrderStatus;
  readonly paymentMethod: OrderPaymentMethod;
  readonly subtotal: number;
  readonly discountCode: string | null;
  readonly discountAmount: number;
  readonly shippingAmount: number;
  readonly total: number;
  readonly currency: string;
  readonly expiresAt: string | null;
  readonly recipientName: string;
  readonly email: string;
  readonly phone: string;
  readonly shippingAddress: string | null;
  readonly items: readonly OrderLine[];
  readonly paymentStatus: OrderPaymentStatus;
  readonly fulfillmentStatus: OrderFulfillmentStatus;
  readonly paidAtUtc: string | null;
  readonly createdOn: string;
  readonly physicalDispatchStarted: boolean;
}

export interface OrderHistoryEntry {
  readonly id: string;
  readonly occurredAtUtc: string;
  readonly action: string;
  readonly actorDisplayName: string | null;
  readonly relatedEntityType: string;
  readonly safeSummary: string;
}

type OrderQueue = 'awaiting-payment' | 'awaiting-processing' | 'needs-review';

export interface OrderListQuery {
  readonly queue: OrderQueue | null;
  readonly q: string;
  readonly status: OrderStatus | null;
  readonly paymentStatus: OrderPaymentStatus | null;
  readonly fulfillmentStatus: OrderFulfillmentStatus | null;
  readonly createdFrom: string;
  readonly createdTo: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface GuestPaymentSettings {
  readonly bankName: string | null;
  readonly accountNumber: string | null;
  readonly accountHolder: string | null;
  readonly branch: string | null;
  readonly instructions: string | null;
  readonly bankTransferEnabled: boolean;
}

interface CheckoutLineRequest {
  readonly variantId: string;
  readonly quantity: number;
}

export interface CheckoutRequest {
  readonly operationId: string;
  readonly recipientName: string;
  readonly email?: string | null;
  readonly phone: string;
  readonly shippingAddress: string | null;
  readonly paymentMethod: OrderPaymentMethod;
  readonly discountCode: string | null;
  readonly expectedTotal: number;
  readonly items: readonly CheckoutLineRequest[];
}

type OrderBadgeTone = 'success' | 'warning' | 'neutral' | 'muted';

export const ORDER_QUEUE_LABELS: Readonly<Record<OrderQueue, string>> = {
  'awaiting-payment': 'Đơn chờ thanh toán',
  'awaiting-processing': 'Đơn chờ hoàn tất',
  'needs-review': 'Đơn cần kiểm tra',
};

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  [OrderStatus.PendingPayment]: 'Chờ thanh toán',
  [OrderStatus.AwaitingProcessing]: 'Chờ xử lý',
  [OrderStatus.Cancelled]: 'Đã hủy',
  [OrderStatus.Expired]: 'Hết hạn',
  [OrderStatus.Completed]: 'Hoàn tất',
  [OrderStatus.Closed]: 'Đã đóng',
};

export const ORDER_PAYMENT_STATUS_LABELS: Readonly<Record<OrderPaymentStatus, string>> = {
  [OrderPaymentStatus.Unpaid]: 'Chưa thanh toán',
  [OrderPaymentStatus.Paid]: 'Đã thanh toán',
};

export const ORDER_FULFILLMENT_STATUS_LABELS: Readonly<Record<OrderFulfillmentStatus, string>> = {
  [OrderFulfillmentStatus.Pending]: 'Chưa bắt đầu',
  [OrderFulfillmentStatus.NeedsReview]: 'Cần kiểm tra',
  [OrderFulfillmentStatus.InProgress]: 'Đang xử lý',
  [OrderFulfillmentStatus.Completed]: 'Đã hoàn tất',
  [OrderFulfillmentStatus.Stopped]: 'Đã dừng',
};

export const ORDER_STATUS_OPTIONS = Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({
  value: Number(value) as OrderStatus,
  label,
}));

export const ORDER_PAYMENT_STATUS_OPTIONS = Object.entries(ORDER_PAYMENT_STATUS_LABELS).map(
  ([value, label]) => ({ value: Number(value) as OrderPaymentStatus, label }),
);

export const ORDER_FULFILLMENT_STATUS_OPTIONS = Object.entries(ORDER_FULFILLMENT_STATUS_LABELS).map(
  ([value, label]) => ({ value: Number(value) as OrderFulfillmentStatus, label }),
);

export const ORDER_PAYMENT_METHOD_LABELS: Readonly<Record<OrderPaymentMethod, string>> = {
  [OrderPaymentMethod.Prepaid]: 'Trả trước',
  [OrderPaymentMethod.CashOnDelivery]: 'Thu hộ (COD)',
};

export const ORDER_PAGE_SIZES: readonly number[] = [10, 20, 50];

export const PRODUCT_FULFILLMENT_OPTIONS = [
  { label: 'Hàng vật lý', value: ProductFulfillmentKind.Physical },
  { label: 'Nội dung số riêng', value: ProductFulfillmentKind.DigitalUnique },
  { label: 'Nội dung số dùng chung', value: ProductFulfillmentKind.DigitalShared },
  { label: 'Gia hạn thủ công', value: ProductFulfillmentKind.ManualExtension },
] as const;

export const EMPTY_ADMIN_ORDER_PAGE: OrderPage = {
  items: [],
  total: 0,
  pageNumber: 1,
  pageSize: 10,
};

export interface OrderPanelMutationEvent {
  readonly preserveActionState: boolean;
}

export interface OrderPanelFailureEvent {
  readonly message: string;
  readonly conflict: boolean;
}

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
    case OrderFulfillmentStatus.NeedsReview:
      return 'Cần kiểm tra';
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
