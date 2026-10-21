import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error';
import { OrderDetail } from '@features/orders/order-detail.component';
import { OrdersService } from '@services/orders.service';
import {
  OrderDto,
  OrderFulfillmentStatus,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
  ProductFulfillmentKind,
  ShipmentStatus,
  ShipmentSummary,
} from '@models/order.dto';

const order = (version = 'v1'): OrderDto => ({
  id: 'order-a',
  number: 'ORD-001',
  version,
  status: OrderStatus.AwaitingProcessing,
  paymentMethod: OrderPaymentMethod.CashOnDelivery,
  subtotal: 300,
  shippingAmount: 0,
  total: 300,
  currency: 'VND',
  expiresAt: null,
  recipientName: 'Nguyễn Văn A',
  email: 'a@example.test',
  phone: '0901234567',
  shippingAddress: 'Hà Nội',
  paymentStatus: OrderPaymentStatus.Unpaid,
  fulfillmentStatus: OrderFulfillmentStatus.Pending,
  paidAtUtc: null,
  createdOn: '2026-10-21T00:00:00Z',
  physicalDispatchStarted: false,
  items: ['A', 'B'].map((id) => ({
    id,
    productId: id,
    variantId: id,
    name: 'Sản phẩm ' + id,
    sku: id,
    optionDescription: '',
    fulfillmentKind: ProductFulfillmentKind.Physical,
    unitPrice: 100,
    quantity: id === 'A' ? 2 : 1,
  })),
});
const shipment = (quantity = 1, status = ShipmentStatus.Dispatched): ShipmentSummary => ({
  id: 'shipment-a',
  orderId: 'order-a',
  orderVersion: 'v2',
  version: 's1',
  carrier: 'Hãng A',
  trackingNumber: 'TRACK-A',
  status,
  dispatchedAtUtc: '2026-10-21T01:00:00Z',
  deliveredAtUtc: status === ShipmentStatus.Delivered ? '2026-10-21T02:00:00Z' : null,
  items: [{ orderItemId: 'A', quantity }],
});
const failure = (status: number) =>
  new ApiError({
    status,
    kind: status === 409 ? 'conflict' : 'network',
    message: 'Không nhận được kết quả',
    fieldErrors: {},
  });

describe('Order shipping commands and drafts', () => {
  let fixture: ComponentFixture<OrderDetail>;
  let screen: OrderDetail;
  const allowed = signal(true);
  let service: {
    get: ReturnType<typeof vi.fn>;
    history: ReturnType<typeof vi.fn>;
    shipments: ReturnType<typeof vi.fn>;
    afterSales: ReturnType<typeof vi.fn>;
    dispatchShipment: ReturnType<typeof vi.fn>;
    deliverShipment: ReturnType<typeof vi.fn>;
  };
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  function draft(a = 1, b = 0): void {
    screen.openDispatch();
    screen.dispatchCarrier.set('Hãng A');
    screen.dispatchTrackingNumber.set('TRACK-A');
    screen.setDispatchQuantity('A', a);
    screen.setDispatchQuantity('B', b);
  }
  beforeEach(async () => {
    allowed.set(true);
    service = {
      get: vi.fn(() => of(order())),
      history: vi.fn(() => of([])),
      shipments: vi.fn(() => of([])),
      afterSales: vi.fn(() => of(null)),
      dispatchShipment: vi.fn(() => of(shipment())),
      deliverShipment: vi.fn(() => of(shipment(1, ShipmentStatus.Delivered))),
    };
    TestBed.configureTestingModule({
      imports: [OrderDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'order-a' })),
            snapshot: { queryParams: {} },
          },
        },
        { provide: AuthSession, useValue: { can: () => allowed() } },
        { provide: OrdersService, useValue: service },
      ],
    });
    TestBed.overrideComponent(OrderDetail, { set: { template: '', imports: [] } });
    fixture = TestBed.createComponent(OrderDetail);
    screen = fixture.componentInstance;
    await settle();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('removes only unavailable selected lines after conflict and leaves the remaining draft usable', async () => {
    draft(2, 1);
    service.get.mockReturnValue(of(order('v2')));
    service.shipments.mockReturnValue(of([shipment(2)]));
    service.dispatchShipment.mockReturnValue(throwError(() => failure(409)));
    screen.submitDispatch();
    await settle();
    expect(screen.pendingDispatch()).toBeNull();
    expect(screen.dispatchQuantities()).toEqual({ B: 1 });
    expect(screen.dispatchCarrier()).toBe('Hãng A');
    expect(screen.dispatchNotice()).toContain('bỏ khỏi lựa chọn');
    expect(screen.dispatchCanSubmit()).toBe(true);
    screen.dispatchDialog.set(false);
    screen.openDispatch();
    expect(screen.dispatchCanSubmit()).toBe(true);
    expect(service.dispatchShipment).toHaveBeenCalledTimes(1);
  });

  it('retries the exact accepted payload after a lost response even when the remaining quantity changed', async () => {
    draft(2);
    service.dispatchShipment
      .mockReturnValueOnce(throwError(() => failure(0)))
      .mockReturnValueOnce(of(shipment(2)));
    screen.submitDispatch();
    await settle();
    const original = service.dispatchShipment.mock.calls[0]?.[1];
    expect(screen.dispatchLocked()).toBe(true);
    screen.dispatchCarrier.set('A newer value cannot alter the retry');
    service.get.mockReturnValue(of(order('v2')));
    service.shipments.mockReturnValue(of([shipment(2)]));
    screen.store.reload();
    await settle();
    expect(screen.store.dispatchableLines().map((line) => line.orderItem.id)).toEqual(['B']);
    screen.submitDispatch();
    await settle();
    expect(service.dispatchShipment.mock.calls[1]?.[1]).toEqual(original);
    expect(screen.pendingDispatch()).toBeNull();
    expect(screen.dispatchDialog()).toBe(false);
  });

  it('starts a new operation only after a definite rejection has been reconciled', async () => {
    draft(1);
    service.dispatchShipment
      .mockReturnValueOnce(throwError(() => failure(409)))
      .mockReturnValueOnce(of(shipment()));
    service.get.mockReturnValue(of(order('v2')));
    screen.submitDispatch();
    await settle();
    const original = service.dispatchShipment.mock.calls[0]?.[1];
    expect(screen.pendingDispatch()).toBeNull();
    screen.dispatchTrackingNumber.set('TRACK-CORRECTED');
    screen.submitDispatch();
    await settle();
    const corrected = service.dispatchShipment.mock.calls[1]?.[1];
    expect(corrected.operationId).not.toBe(original.operationId);
    expect(corrected.orderVersion).toBe('v2');
    expect(corrected.trackingNumber).toBe('TRACK-CORRECTED');
  });

  it('preserves an unrelated dispatch draft when a delivery succeeds', async () => {
    service.shipments.mockReturnValue(of([shipment(1)]));
    screen.store.reload();
    await settle();
    draft(0, 1);
    screen.dispatchDialog.set(false);
    screen.openDelivery(shipment(1));
    screen.submitDelivery();
    await settle();
    expect(screen.deliveryTarget()).toBeNull();
    expect(screen.dispatchCarrier()).toBe('Hãng A');
    expect(screen.dispatchTrackingNumber()).toBe('TRACK-A');
    expect(screen.dispatchQuantities()['B']).toBe(1);
  });

  it('preserves delivery request versions and operation ID after an uncertain response', async () => {
    service.shipments.mockReturnValue(of([shipment()]));
    screen.store.reload();
    await settle();
    service.deliverShipment
      .mockReturnValueOnce(throwError(() => failure(503)))
      .mockReturnValueOnce(of(shipment(1, ShipmentStatus.Delivered)));
    screen.openDelivery(shipment());
    screen.submitDelivery();
    await settle();
    const original = service.deliverShipment.mock.calls[0]?.[2];
    service.get.mockReturnValue(of(order('v3')));
    service.shipments.mockReturnValue(of([shipment(1, ShipmentStatus.Delivered)]));
    screen.store.reload();
    await settle();
    expect(screen.currentDeliveryCanSubmit()).toBe(true);
    screen.submitDelivery();
    await settle();
    expect(service.deliverShipment.mock.calls[1]?.[2]).toEqual(original);
    expect(screen.pendingDeliveries()).toEqual({});
  });

  it('checks permissions for direct calls and prevents duplicate requests while busy', async () => {
    const response = new Subject<ShipmentSummary>();
    service.dispatchShipment.mockReturnValue(response);
    draft();
    screen.submitDispatch();
    screen.submitDispatch();
    expect(service.dispatchShipment).toHaveBeenCalledTimes(1);
    expect(screen.confirmLeave()).toBe(false);
    response.next(shipment());
    response.complete();
    await settle();
    allowed.set(false);
    screen.store
      .dispatchShipment(
        { orderVersion: 'v1', operationId: 'op', carrier: 'A', trackingNumber: 'A', items: [] },
        true,
      )
      .subscribe();
    screen.store
      .deliverShipment(shipment(), { orderVersion: 'v1', version: 's1', operationId: 'op' }, true)
      .subscribe();
    expect(service.dispatchShipment).toHaveBeenCalledTimes(1);
    expect(service.deliverShipment).not.toHaveBeenCalled();
  });

  it('calculates partial physical quantities without including digital lines', async () => {
    const mixed = order();
    const physicalLine = mixed.items[0];
    if (!physicalLine) throw new Error('The order fixture needs a physical line.');
    service.get.mockReturnValue(
      of({
        ...mixed,
        items: [
          ...mixed.items,
          {
            ...physicalLine,
            id: 'digital',
            fulfillmentKind: ProductFulfillmentKind.DigitalUnique,
          },
        ],
      }),
    );
    service.shipments.mockReturnValue(of([shipment(1)]));
    screen.store.reload();
    await settle();
    expect(
      screen.store.dispatchableLines().map((line) => [line.orderItem.id, line.remaining]),
    ).toEqual([
      ['A', 1],
      ['B', 1],
    ]);
  });
});
