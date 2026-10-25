import { OrderPaymentMethod } from '@models/order.dto';

export const STOREFRONT_PAYMENT_METHODS = [
  {
    value: OrderPaymentMethod.Prepaid,
    label: 'Chuyển khoản ngân hàng',
    description:
      'Nhân viên xác nhận khoản tiền thực nhận. Hàng số chỉ mở sau khi đơn được đánh dấu đã thanh toán.',
  },
  {
    value: OrderPaymentMethod.CashOnDelivery,
    label: 'Thanh toán khi nhận hàng (COD)',
    description: 'Thanh toán tiền mặt khi shipper giao hàng (chỉ áp dụng cho hàng vật lý).',
  },
] as const;
