export type PaymentSource = 'ManualBankTransfer' | 'ManualCOD';

export interface ConfirmPaymentRequest {
  readonly version: string;
  readonly operationId: string;
  readonly reference: string;
  readonly amount: number;
  readonly currency: string;
  readonly receivedAtUtc: string;
  readonly source: PaymentSource;
}

export interface RetryFulfillmentRequest {
  readonly version: string;
  readonly operationId?: string;
}

export interface DigitalDeliveryDto {
  readonly id: string;
  readonly orderItemId: string;
  readonly sequence: number;
  readonly content: string;
}

export interface PaymentPanelOrder {
  readonly id: string;
  readonly version: string;
  readonly status: number;
  readonly paymentMethod: number;
  readonly paymentStatus: number;
  readonly fulfillmentStatus: number;
  readonly total: number;
  readonly currency: string;
  readonly paidAtUtc: string | null;
  readonly physicalDispatchStarted: boolean;
}

export interface PaymentActionFailure {
  readonly message: string;
  readonly conflict: boolean;
}

export const PAYMENT_ORDER_STATUS = {
  Cancelled: 3,
  Closed: 6,
} as const;

export const PAYMENT_METHOD_CODE = {
  Prepaid: 1,
  CashOnDelivery: 2,
} as const;

export const PAYMENT_STATUS_CODE = {
  Unpaid: 1,
  Paid: 2,
} as const;

export const PAYMENT_FULFILLMENT_STATUS_CODE = {
  NeedsReview: 2,
} as const;

export const ORDER_PAYMENT_SOURCE_OPTIONS = [
  { label: 'Chuyển khoản ngân hàng', value: 'ManualBankTransfer' as const },
  { label: 'Thu hộ khi giao hàng (COD)', value: 'ManualCOD' as const },
] as const;
