import { ProductFulfillmentKind } from './storefront.dto';

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

export interface CheckoutRequest {
  readonly cartVersion: string;
  readonly operationId?: string;
  readonly paymentMethod: OrderPaymentMethod;
  readonly recipientName: string;
  readonly email: string;
  readonly phone: string;
  readonly shippingAddress: string | null;
  readonly expectedTotal: number;
}

export interface CheckoutWireRequest extends CheckoutRequest {
  readonly operationId: string;
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
