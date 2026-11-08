export enum ShipmentStatus {
  Dispatched = 1,
  Delivered = 2,
}

export interface ShipmentLineDto {
  readonly orderItemId: string;
  readonly quantity: number;
}

export interface ShipmentDto {
  readonly id: string;
  readonly orderId: string;
  readonly orderVersion: string;
  readonly version: string;
  readonly carrier: string;
  readonly trackingNumber: string;
  readonly status: ShipmentStatus;
  readonly dispatchedAtUtc: string;
  readonly deliveredAtUtc: string | null;
  readonly items: readonly ShipmentLineDto[];
}

export type ShipmentSummary = ShipmentDto;

export interface DispatchShipmentRequest {
  readonly orderVersion: string;
  readonly operationId: string;
  readonly carrier: string;
  readonly trackingNumber: string;
  readonly items: readonly ShipmentLineDto[];
}

export type CreateShipmentRequest = DispatchShipmentRequest;

export interface DeliverShipmentRequest {
  readonly orderVersion: string;
  readonly version: string;
  readonly operationId: string;
}

export interface ShippableOrderItem {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly fulfillmentKind: number;
  readonly quantity: number;
}

export interface ShippableOrder {
  readonly id: string;
  readonly version: string;
  readonly status: number;
  readonly paymentMethod: number;
  readonly paymentStatus: number;
  readonly fulfillmentStatus: number;
  readonly items: readonly ShippableOrderItem[];
}

export interface DispatchableLine {
  readonly orderItem: ShippableOrderItem;
  readonly remaining: number;
}

export type ShippingFailureKind = 'rejected' | 'uncertain' | null;

export interface ShippingActionFailure {
  readonly message: string;
  readonly conflict: boolean;
}

export interface ShippingMutationEvent {
  readonly preserveActionState: boolean;
}

export const SHIPPING_ORDER_STATUS = {
  Cancelled: 3,
  Expired: 4,
  Closed: 6,
} as const;

export const SHIPPING_PAYMENT_METHOD = {
  Prepaid: 1,
  CashOnDelivery: 2,
} as const;

export const SHIPPING_PAYMENT_STATUS = {
  Unpaid: 1,
  Paid: 2,
} as const;

export const SHIPPING_FULFILLMENT_STATUS = {
  NeedsReview: 2,
} as const;

export const SHIPPING_FULFILLMENT_KIND = {
  Physical: 1,
} as const;

export const SHIPMENT_STATUS_LABELS: Readonly<Record<ShipmentStatus, string>> = {
  [ShipmentStatus.Dispatched]: 'Đang giao',
  [ShipmentStatus.Delivered]: 'Đã giao',
};
