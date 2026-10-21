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

export interface ShipmentSummary {
  readonly id: string;
  readonly carrier: string;
  readonly trackingNumber: string;
  readonly status: number;
  readonly dispatchedAtUtc: string;
  readonly deliveredAtUtc: string | null;
}

export interface AfterSalesSummary {
  readonly orderId: string;
  readonly orderVersion: string;
  readonly closed: boolean;
  readonly receivedAmount: number;
  readonly refundedAmount: number;
  readonly refundableAmount: number;
}

export interface OrderListQuery {
  readonly q: string;
  readonly status: OrderStatus | null;
  readonly paymentStatus: OrderPaymentStatus | null;
  readonly fulfillmentStatus: OrderFulfillmentStatus | null;
  readonly createdFrom: string;
  readonly createdTo: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface ConfirmPaymentRequest {
  readonly version: string;
  readonly operationId: string;
  readonly reference: string;
  readonly amount: number;
  readonly currency: string;
  readonly receivedAtUtc: string;
  readonly source: 'ManualBankTransfer' | 'ManualCOD';
}
