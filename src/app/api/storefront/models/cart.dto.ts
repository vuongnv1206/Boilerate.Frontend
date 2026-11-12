import { ProductFulfillmentKind } from './storefront.dto';

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

interface CartLineDto {
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

export interface AddCartItemInput {
  readonly variantId: string;
  readonly quantity: number;
  readonly productId?: string;
  readonly name?: string;
  readonly sku?: string;
  readonly unitPrice?: number;
  readonly isDigital?: boolean;
}

export const EMPTY_CART: CartDto = {
  id: '',
  version: null,
  items: [],
  subtotal: 0,
  discountCode: null,
  discountAmount: 0,
  discountError: null,
  shippingAmount: 0,
  total: 0,
  canCheckout: false,
  hasDigitalItems: false,
};
