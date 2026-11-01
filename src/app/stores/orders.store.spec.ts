import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrdersService } from '@services/orders.service';
import {
  OrderDto,
  OrderFulfillmentStatus,
  OrderListQuery,
  OrderPage,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
} from '@models/order.dto';
import { OrdersStore } from './orders.store';

const order = (version = 'v2'): OrderDto => ({
  id: 'a',
  number: 'ORD-A',
  version,
  status: OrderStatus.Cancelled,
  paymentMethod: OrderPaymentMethod.Prepaid,
  subtotal: 100,
  discountCode: null,
  discountAmount: 0,
  shippingAmount: 0,
  total: 100,
  currency: 'VND',
  expiresAt: null,
  recipientName: 'Khách A',
  email: 'a@example.test',
  phone: '',
  shippingAddress: null,
  items: [],
  paymentStatus: OrderPaymentStatus.Unpaid,
  fulfillmentStatus: OrderFulfillmentStatus.Pending,
  paidAtUtc: null,
  createdOn: '2026-10-21T00:00:00Z',
  physicalDispatchStarted: false,
});
const page = (items: OrderPage['items'] = [], pageNumber = 1, total = items.length): OrderPage => ({
  items,
  pageNumber,
  total,
  pageSize: 10,
});

describe('OrdersStore canonical rail refresh', () => {
  let store: OrdersStore;
  let service: { list: ReturnType<typeof vi.fn> };
  let query: OrderListQuery;
  beforeEach(() => {
    service = { list: vi.fn(() => of(page())) };
    TestBed.configureTestingModule({
      providers: [OrdersStore, { provide: OrdersService, useValue: service }],
    });
    store = TestBed.inject(OrdersStore);
    query = {
      ...store.query(),
      queue: 'awaiting-processing',
      status: OrderStatus.AwaitingProcessing,
      q: 'Khách',
      page: 2,
    };
  });
  afterEach(() => TestBed.resetTestingModule());

  it('replaces a changed filtered row with the server page and corrects the last page once', () => {
    service.list.mockReturnValueOnce(
      of(page([{ ...order('v1'), status: OrderStatus.AwaitingProcessing }], 2, 11)),
    );
    store.applyQuery(query);
    service.list.mockReturnValueOnce(of(page([], 2, 10)));
    store.updateVisibleOrder(order());
    expect(service.list).toHaveBeenLastCalledWith(query);
    expect(store.queryCorrection()).toBe(1);
    service.list.mockReturnValueOnce(of(page([{ ...order(), id: 'b' }], 1, 10)));
    store.applyQuery({ ...query, page: 1 });
    expect(store.page().items.map((item) => item.id)).toEqual(['b']);
    expect(store.queryCorrection()).toBeNull();
    store.updateVisibleOrder(order());
    expect(service.list).toHaveBeenCalledTimes(3);
  });

  it('refreshes the latest query, cancels stale list results and deduplicates the same detail version', () => {
    const stale = new Subject<OrderPage>();
    service.list.mockReturnValueOnce(stale);
    store.applyQuery(query);
    const latest = { ...query, q: 'Mới', page: 1 };
    store.applyQuery(latest);
    service.list.mockReturnValueOnce(of(page([{ ...order(), id: 'canonical' }])));
    store.updateVisibleOrder(order());
    stale.next(page([order()], 2, 11));
    expect(service.list).toHaveBeenLastCalledWith(latest);
    expect(store.page().items[0]?.id).toBe('canonical');
    store.updateVisibleOrder(order());
    expect(service.list).toHaveBeenCalledTimes(3);
    store.updateVisibleOrder(order('v3'));
    expect(service.list).toHaveBeenCalledTimes(4);
  });

  it('keeps the last canonical list after a refresh failure and supports explicit read retry', () => {
    service.list.mockReturnValueOnce(
      of(page([{ ...order('v1'), status: OrderStatus.AwaitingProcessing }])),
    );
    store.applyQuery({ ...query, page: 1 });
    service.list.mockReturnValueOnce(throwError(() => new Error('offline')));
    store.updateVisibleOrder(order());
    expect(store.error()).not.toBe('');
    expect(store.page().items[0]?.status).toBe(OrderStatus.AwaitingProcessing);
    service.list.mockReturnValueOnce(of(page()));
    store.load();
    expect(store.page().items).toEqual([]);
    expect(store.error()).toBe('');
  });
});
