import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error';
import { OrderDetail } from '@features/orders/order-detail.component';
import {
  AfterSalesSummary,
  OrderDto,
  OrderFulfillmentStatus,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
  ProductFulfillmentKind,
  ShipmentStatus,
  ShipmentSummary,
} from '@models/order.dto';
import { OrdersService } from '@services/orders.service';

const order = (
  version = 'v1',
  method = OrderPaymentMethod.Prepaid,
  payment = OrderPaymentStatus.Paid,
): OrderDto => ({
  id: 'order-a',
  number: 'ORD-001',
  version,
  status: OrderStatus.AwaitingProcessing,
  paymentMethod: method,
  subtotal: 300,
  shippingAmount: 0,
  total: 300,
  currency: 'VND',
  expiresAt: null,
  recipientName: 'Nguyễn Văn A',
  email: 'a@example.test',
  phone: '0901234567',
  shippingAddress: 'Hà Nội',
  paymentStatus: payment,
  fulfillmentStatus: OrderFulfillmentStatus.InProgress,
  paidAtUtc: '2026-10-20T00:00:00Z',
  createdOn: '2026-10-19T00:00:00Z',
  physicalDispatchStarted: true,
  items: [
    {
      id: 'line-a',
      productId: 'product-a',
      variantId: 'variant-a',
      name: 'Sản phẩm A',
      sku: 'SKU-A',
      optionDescription: '',
      fulfillmentKind: ProductFulfillmentKind.Physical,
      unitPrice: 100,
      quantity: 2,
    },
  ],
});

const shipment: ShipmentSummary = {
  id: 'shipment-a',
  orderId: 'order-a',
  orderVersion: 'v2',
  version: 's1',
  carrier: 'Hãng A',
  trackingNumber: 'TRACK-1',
  status: ShipmentStatus.Dispatched,
  dispatchedAtUtc: '2026-10-19T03:00:00Z',
  deliveredAtUtc: null,
  items: [{ orderItemId: 'line-a', quantity: 2 }],
};

const summary = (version = 'v1'): AfterSalesSummary => ({
  orderId: 'order-a',
  orderVersion: version,
  closed: false,
  receivedAmount: 300,
  refundedAmount: 0,
  refundableAmount: 300,
  refunds: [],
  returns: [],
});

const networkFailure = () =>
  new ApiError({ status: 0, kind: 'network', message: 'Kết nối bị gián đoạn', fieldErrors: {} });
const localDateTime = (): string => {
  const date = new Date(Date.now() - 60_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

describe('Order after-sales drafts and mutation retries', () => {
  let fixture: ComponentFixture<OrderDetail>;
  let screen: OrderDetail;
  let service: {
    get: ReturnType<typeof vi.fn>;
    history: ReturnType<typeof vi.fn>;
    shipments: ReturnType<typeof vi.fn>;
    afterSales: ReturnType<typeof vi.fn>;
    confirmRefund: ReturnType<typeof vi.fn>;
    receiveReturn: ReturnType<typeof vi.fn>;
  };
  const grants = signal(
    new Set([
      'AfterSales.View',
      'Refund.Confirm',
      'Return.Receive',
      'Shipping.View',
      'Inventory.Adjust',
    ]),
  );

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    grants.set(
      new Set([
        'AfterSales.View',
        'Refund.Confirm',
        'Return.Receive',
        'Shipping.View',
        'Inventory.Adjust',
      ]),
    );
    service = {
      get: vi.fn(() => of(order())),
      history: vi.fn(() => of([])),
      shipments: vi.fn(() => of([shipment])),
      afterSales: vi.fn(() => of(summary())),
      confirmRefund: vi.fn(() =>
        of({
          refund: {
            id: 'refund-a',
            receiptId: 'receipt-a',
            reference: 'RF-1',
            source: 'ManualBankTransfer',
            amount: 100,
            currency: 'VND',
            reason: 'Lý do A',
            refundedAtUtc: '2026-10-21T00:00:00Z',
          },
          orderVersion: 'v2',
          closed: false,
        }),
      ),
      receiveReturn: vi.fn(() =>
        of({
          return: {
            id: 'return-a',
            reference: 'RT-1',
            reason: 'Lý do B',
            receivedAtUtc: '2026-10-21T00:00:00Z',
            closeRemainingCod: false,
            items: [
              { shipmentId: 'shipment-a', orderItemId: 'line-a', quantity: 1, restockQuantity: 1 },
            ],
          },
          orderVersion: 'v2',
          closed: false,
        }),
      ),
    };
    TestBed.configureTestingModule({
      imports: [OrderDetail],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'order-a' })),
            snapshot: { queryParams: {} },
          },
        },
        {
          provide: AuthSession,
          useValue: {
            can: (functionCode: string, actionCode: string) =>
              grants().has(`${functionCode}.${actionCode}`),
          },
        },
        { provide: OrdersService, useValue: service },
      ],
    });
    TestBed.overrideComponent(OrderDetail, { set: { template: '', imports: [] } });
    fixture = TestBed.createComponent(OrderDetail);
    screen = fixture.componentInstance;
    await settle();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('retries the exact refund snapshot after an uncertain response', async () => {
    service.confirmRefund.mockReturnValueOnce(throwError(() => networkFailure()));
    screen.openRefundForm();
    screen.refundReference.set('RF-LOCAL-1');
    screen.refundAmount.set(125);
    screen.refundReason.set('Đã đối chiếu giao dịch');
    screen.refundAt.set(localDateTime());
    expect(screen.refundCanSubmit()).toBe(true);
    screen.submitRefund();
    await settle();
    const original = service.confirmRefund.mock.calls[0]?.[1];
    expect(screen.pendingRefund()).toEqual(original);
    expect(screen.store.afterSalesActionFailure()).toBe('uncertain');
    screen.submitRefund();
    await settle();
    expect(service.confirmRefund).toHaveBeenCalledTimes(2);
    expect(service.confirmRefund.mock.calls[1]?.[1]).toEqual(original);
    expect(screen.pendingRefund()).toBeNull();
    expect(screen.refundFormOpen()).toBe(false);
  });

  it('keeps a rejected refund draft and uses the refreshed order version on correction', async () => {
    service.confirmRefund.mockReturnValueOnce(
      throwError(
        () =>
          new ApiError({
            status: 409,
            kind: 'conflict',
            message: 'Version conflict',
            fieldErrors: {},
          }),
      ),
    );
    screen.openRefundForm();
    screen.refundReference.set('RF-LOCAL-2');
    screen.refundAmount.set(100);
    screen.refundReason.set('Đối chiếu');
    screen.refundAt.set(localDateTime());
    service.get.mockReturnValue(of(order('v2')));
    service.afterSales.mockReturnValue(of(summary('v2')));
    screen.submitRefund();
    await settle();
    expect(screen.pendingRefund()).toBeNull();
    expect(screen.refundReference()).toBe('RF-LOCAL-2');
    expect(screen.refundAmount()).toBe(100);
    screen.submitRefund();
    await settle();
    const requests = service.confirmRefund.mock.calls.map((call) => call[1]);
    expect(requests[0]?.orderVersion).toBe('v1');
    expect(requests[1]?.orderVersion).toBe('v2');
    expect(requests[1]?.operationId).not.toBe(requests[0]?.operationId);
  });

  it('calculates only dispatched physical quantities and retries the same return payload', async () => {
    service.receiveReturn.mockReturnValueOnce(throwError(() => networkFailure()));
    screen.openReturnForm();
    screen.returnReference.set('RT-LOCAL-1');
    screen.returnReason.set('Hàng lỗi');
    screen.setReturnQuantity('shipment-a', 'line-a', 1);
    screen.setRestockQuantity('shipment-a', 'line-a', 1);
    expect(screen.returnableLines().map((line) => [line.name, line.remaining])).toEqual([
      ['Sản phẩm A', 2],
    ]);
    expect(screen.returnCanSubmit()).toBe(true);
    screen.submitReturn();
    await settle();
    const original = service.receiveReturn.mock.calls[0]?.[1];
    expect(original.items).toEqual([
      { shipmentId: 'shipment-a', orderItemId: 'line-a', quantity: 1, restockQuantity: 1 },
    ]);
    screen.submitReturn();
    await settle();
    expect(service.receiveReturn).toHaveBeenCalledTimes(2);
    expect(service.receiveReturn.mock.calls[1]?.[1]).toEqual(original);
    expect(screen.pendingReturn()).toBeNull();
  });

  it('allows closing unpaid COD only when this return receives every unreturned dispatched item', async () => {
    service.get.mockReturnValue(
      of(order('v1', OrderPaymentMethod.CashOnDelivery, OrderPaymentStatus.Unpaid)),
    );
    screen.store.reload();
    await settle();
    screen.openReturnForm();
    screen.returnReference.set('RT-COD-1');
    screen.returnReason.set('Khách trả toàn bộ');
    screen.setReturnQuantity('shipment-a', 'line-a', 1);
    expect(screen.returnSelectionCompletesDispatched()).toBe(false);
    screen.closeRemainingCod.set(true);
    expect(screen.returnCanSubmit()).toBe(false);
    screen.setReturnQuantity('shipment-a', 'line-a', 2);
    expect(screen.returnSelectionCompletesDispatched()).toBe(true);
    expect(screen.returnCanSubmit()).toBe(true);
  });

  it('requires independent view, return, and inventory permissions', () => {
    screen.openReturnForm();
    screen.returnReference.set('RT-LOCAL-3');
    screen.returnReason.set('Hàng lỗi');
    screen.setReturnQuantity('shipment-a', 'line-a', 1);
    screen.setRestockQuantity('shipment-a', 'line-a', 1);
    grants.set(new Set(['AfterSales.View', 'Return.Receive', 'Shipping.View']));
    expect(screen.canRefund()).toBe(false);
    expect(screen.returnCanSubmit()).toBe(false);
    screen.store
      .receiveReturn({
        orderVersion: 'v1',
        operationId: 'op-direct',
        reference: 'RT-DIRECT',
        reason: 'test',
        items: [
          { shipmentId: 'shipment-a', orderItemId: 'line-a', quantity: 1, restockQuantity: 1 },
        ],
        closeRemainingCod: false,
      })
      .subscribe();
    expect(service.receiveReturn).not.toHaveBeenCalled();
  });
});
