import { OrderPaymentMethod } from './order.dto';

export interface CheckoutRequest {
  readonly cartVersion: string;
  readonly operationId: string;
  readonly paymentMethod: OrderPaymentMethod;
  readonly recipientName: string;
  readonly email: string;
  readonly phone: string;
  readonly shippingAddress: string | null;
  readonly expectedTotal: number;
}
