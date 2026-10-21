import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error';
import {
  OrderDto,
  OrderFulfillmentStatus,
  OrderHistoryEntry,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
} from '@models/order.dto';
import { OrdersService } from '@services/orders.service';
import { OrderDetailStore } from '@stores/order-detail.store';

describe('OrderDetailStore', () => {
  const historyEntry = (relatedEntityType: string): OrderHistoryEntry => ({
    id: `${relatedEntityType}-1`,
    occurredAtUtc: '2026-10-21T00:00:00Z',
    action: 'Updated',
    actorDisplayName: 'Operator',
    relatedEntityType,
    safeSummary: `${relatedEntityType}: Record updated`,
  });

  const makeOrder = (overrides: Partial<OrderDto> = {}): OrderDto => ({
    id: 'order-a',
    number: 'ORD-001',
    version: 'v1',
    status: OrderStatus.AwaitingProcessing,
    paymentMethod: OrderPaymentMethod.Prepaid,
    subtotal: 100,
    shippingAmount: 0,
    total: 100,
    currency: 'VND',
    expiresAt: null,
    recipientName: 'Nguyễn Văn A',
    email: 'customer@example.test',
    phone: '0901234567',
    shippingAddress: '123 Test Street',
    items: [],
    paymentStatus: OrderPaymentStatus.Unpaid,
    fulfillmentStatus: OrderFulfillmentStatus.Pending,
    paidAtUtc: null,
    createdOn: '2026-10-21T00:00:00Z',
    physicalDispatchStarted: false,
    ...overrides,
  });

  let service: {
    get: ReturnType<typeof vi.fn>;
    history: ReturnType<typeof vi.fn>;
    shipments: ReturnType<typeof vi.fn>;
    afterSales: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    confirmPayment: ReturnType<typeof vi.fn>;
    retryFulfillment: ReturnType<typeof vi.fn>;
  };
  let auth: { hasPermission: ReturnType<typeof vi.fn> };
  let store: OrderDetailStore;

  beforeEach(() => {
    service = {
      get: vi.fn(() => of(makeOrder())),
      history: vi.fn(() => of([])),
      shipments: vi.fn(() => of([])),
      afterSales: vi.fn(() => of(null)),
      cancel: vi.fn(() => of(makeOrder({ status: OrderStatus.Cancelled, version: 'v2' }))),
      confirmPayment: vi.fn(() => of(makeOrder({ paymentStatus: OrderPaymentStatus.Paid }))),
      retryFulfillment: vi.fn(() => of(makeOrder({ version: 'v2' }))),
    };
    auth = { hasPermission: vi.fn(() => true) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: auth },
        OrderDetailStore,
        { provide: OrdersService, useValue: service },
      ],
    });
    store = TestBed.inject(OrderDetailStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('gates cancel and retry actions with payment and physical dispatch state', () => {
    service.get.mockReturnValueOnce(of(makeOrder()));
    store.load('order-a');
    expect(store.canCancel()).toBe(true);

    service.get.mockReturnValueOnce(
      of(makeOrder({ paymentStatus: OrderPaymentStatus.Paid, physicalDispatchStarted: false })),
    );
    store.load('order-a');
    expect(store.canCancel()).toBe(false);

    service.get.mockReturnValueOnce(
      of(
        makeOrder({
          paymentStatus: OrderPaymentStatus.Paid,
          fulfillmentStatus: OrderFulfillmentStatus.NeedsReview,
          physicalDispatchStarted: false,
        }),
      ),
    );
    store.load('order-a');
    expect(store.canRetryFulfillment()).toBe(true);

    service.get.mockReturnValueOnce(
      of(
        makeOrder({
          paymentStatus: OrderPaymentStatus.Paid,
          fulfillmentStatus: OrderFulfillmentStatus.NeedsReview,
          physicalDispatchStarted: true,
        }),
      ),
    );
    store.load('order-a');
    expect(store.canRetryFulfillment()).toBe(false);
  });

  it('ignores history from a previously opened order after route reuse', () => {
    const historyA = new Subject<readonly OrderHistoryEntry[]>();
    const historyB = new Subject<readonly OrderHistoryEntry[]>();
    service.get
      .mockReturnValueOnce(of(makeOrder({ id: 'order-a' })))
      .mockReturnValueOnce(of(makeOrder({ id: 'order-b' })));
    service.history.mockReturnValueOnce(historyA).mockReturnValueOnce(historyB);

    store.load('order-a');
    store.load('order-b');
    historyA.next([historyEntry('Orders')]);
    expect(store.order()?.id).toBe('order-b');
    expect(store.history()).toEqual([]);

    historyB.next([historyEntry('Orders')]);
    expect(store.history()).toEqual([historyEntry('Orders')]);
  });

  it('does not apply a mutation response after the user opens another order', () => {
    const cancelResponse = new Subject<OrderDto>();
    service.get
      .mockReturnValueOnce(of(makeOrder({ id: 'order-a' })))
      .mockReturnValueOnce(of(makeOrder({ id: 'order-b' })));
    service.cancel.mockReturnValue(cancelResponse);

    store.load('order-a');
    store.cancel();
    store.load('order-b');
    cancelResponse.next(makeOrder({ id: 'order-a', status: OrderStatus.Cancelled, version: 'v2' }));

    expect(store.order()?.id).toBe('order-b');
    expect(store.actionBusy()).toBe(false);
  });

  it('keeps the conflict warning after reloading the latest DTO without retrying the command', () => {
    const error = new ApiError({
      kind: 'conflict',
      status: 409,
      message: 'Stale version',
      fieldErrors: {},
    });
    service.cancel.mockReturnValue(throwError(() => error));

    store.load('order-a');
    store.cancel();

    expect(service.cancel).toHaveBeenCalledTimes(1);
    expect(service.get).toHaveBeenCalledTimes(2);
    expect(store.order()?.id).toBe('order-a');
    expect(store.conflict()).toBe(true);
    expect(store.actionError()).toContain('đã thay đổi');
    expect(store.actionBusy()).toBe(false);
  });

  it('keeps lazy-load errors visible instead of treating them as empty sections', () => {
    const error = new ApiError({
      kind: 'server',
      status: 500,
      message: 'Endpoint unavailable',
      fieldErrors: {},
    });
    service.history.mockReturnValue(throwError(() => error));
    service.shipments.mockReturnValue(throwError(() => error));
    service.afterSales.mockReturnValue(throwError(() => error));

    store.load('order-a');

    expect(store.historyError()).toBe('Endpoint unavailable');
    expect(store.shippingError()).toBe('Endpoint unavailable');
    expect(store.afterSalesError()).toBe('Endpoint unavailable');
    expect(store.relatedLoading()).toBe(false);
  });
});
