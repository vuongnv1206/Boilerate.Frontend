export type RefundSource = 'ManualBankTransfer' | 'ManualCash';

export interface ReturnLineInput {
  readonly shipmentId: string;
  readonly orderItemId: string;
  readonly quantity: number;
  readonly restockQuantity: number;
}

export interface RefundDto {
  readonly id: string;
  readonly receiptId: string;
  readonly reference: string;
  readonly source: RefundSource;
  readonly amount: number;
  readonly currency: string;
  readonly reason: string;
  readonly refundedAtUtc: string;
}

export interface PhysicalReturnDto {
  readonly id: string;
  readonly reference: string;
  readonly reason: string;
  readonly receivedAtUtc: string;
  readonly closeRemainingCod: boolean;
  readonly items: readonly ReturnLineInput[];
}

export interface AfterSalesSummaryDto {
  readonly orderId: string;
  readonly orderVersion: string;
  readonly closed: boolean;
  readonly receivedAmount: number;
  readonly refundedAmount: number;
  readonly refundableAmount: number;
  readonly refunds: readonly RefundDto[];
  readonly returns: readonly PhysicalReturnDto[];
}

export interface RecordRefundRequest {
  readonly orderVersion: string;
  readonly operationId: string;
  readonly reference: string;
  readonly amount: number;
  readonly currency: 'VND';
  readonly refundedAtUtc: string;
  readonly reason: string;
  readonly source: RefundSource;
}

export type ConfirmRefundRequest = RecordRefundRequest;

export interface RecordReturnRequest {
  readonly orderVersion: string;
  readonly operationId: string;
  readonly reference: string;
  readonly reason: string;
  readonly items: readonly ReturnLineInput[];
  readonly closeRemainingCod: boolean;
}

export type ReceiveReturnRequest = RecordReturnRequest;

export interface RefundResult {
  readonly refund: RefundDto;
  readonly orderVersion: string;
  readonly closed: boolean;
}

export interface ReturnResult {
  readonly return: PhysicalReturnDto;
  readonly orderVersion: string;
  readonly closed: boolean;
}

export interface AfterSalesOrderItemSnapshot {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly fulfillmentKind: number;
  readonly quantity: number;
}

export interface AfterSalesOrderSnapshot {
  readonly id: string;
  readonly version: string;
  readonly currency: string;
  readonly paymentMethod: number;
  readonly paymentStatus: number;
  readonly items: readonly AfterSalesOrderItemSnapshot[];
}

export interface ReturnableLine {
  readonly shipmentId: string;
  readonly carrier: string;
  readonly trackingNumber: string;
  readonly orderItemId: string;
  readonly name: string;
  readonly sku: string;
  readonly remaining: number;
}

export type AfterSalesFailureKind = 'rejected' | 'uncertain' | null;

export interface AfterSalesMutationEvent {
  readonly preserveActionState: boolean;
}

export const AFTER_SALES_PAYMENT_METHOD = {
  Prepaid: 1,
  CashOnDelivery: 2,
} as const;

export const AFTER_SALES_PAYMENT_STATUS = {
  Unpaid: 1,
  Paid: 2,
} as const;

export const AFTER_SALES_FULFILLMENT_KIND = {
  Physical: 1,
} as const;

export const ORDER_REFUND_SOURCE_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: RefundSource;
}> = [
  { label: 'Chuyển khoản ngân hàng', value: 'ManualBankTransfer' },
  { label: 'Tiền mặt', value: 'ManualCash' },
];
