import { ProductFulfillmentKind } from './order.dto';

export interface CartLineInput {
  readonly variantId: string;
  readonly quantity: number;
}

export interface SaveCartRequest {
  readonly version: string | null;
  readonly items: readonly CartLineInput[];
}

export interface SetCartDiscountRequest {
  readonly version: string | null;
  readonly code: string | null;
}

export interface CartLineDto {
  readonly variantId: string;
  readonly quantity: number;
  readonly name: string;
  readonly sku: string;
  readonly unitPrice: number | null;
  readonly isAvailable: boolean;
  readonly fulfillmentKind: ProductFulfillmentKind;
}

export interface CartDto {
  readonly id: string;
  readonly version: string | null;
  readonly items: readonly CartLineDto[];
  readonly subtotal: number;
  readonly discountCode: string | null;
  readonly discountAmount: number;
  readonly discountError: string | null;
  readonly shippingAmount: number;
  readonly total: number;
  readonly canCheckout: boolean;
  readonly hasDigitalItems: boolean;
}

export interface GuestCartItem {
  readonly variantId: string;
  readonly productId: string;
  readonly name: string;
  readonly sku: string;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly isDigital: boolean;
}
