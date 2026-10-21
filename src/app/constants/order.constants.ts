import {
  OrderFulfillmentStatus,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
} from '@models/order.dto';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PendingPayment]: 'Chờ thanh toán',
  [OrderStatus.AwaitingProcessing]: 'Chờ xử lý',
  [OrderStatus.Cancelled]: 'Đã hủy',
  [OrderStatus.Expired]: 'Hết hạn',
  [OrderStatus.Completed]: 'Hoàn tất',
  [OrderStatus.Closed]: 'Đã đóng',
};

export const ORDER_PAYMENT_STATUS_LABELS: Record<OrderPaymentStatus, string> = {
  [OrderPaymentStatus.Unpaid]: 'Chưa thanh toán',
  [OrderPaymentStatus.Paid]: 'Đã thanh toán',
};

export const ORDER_FULFILLMENT_STATUS_LABELS: Record<OrderFulfillmentStatus, string> = {
  [OrderFulfillmentStatus.Pending]: 'Chờ fulfillment',
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

export const ORDER_PAYMENT_METHOD_LABELS: Record<OrderPaymentMethod, string> = {
  [OrderPaymentMethod.Prepaid]: 'Trả trước',
  [OrderPaymentMethod.CashOnDelivery]: 'COD',
};

export const ORDER_PAGE_SIZES = [10, 20, 50] as const;
