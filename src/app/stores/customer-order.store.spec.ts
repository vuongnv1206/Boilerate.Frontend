import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OrderDto,
  OrderFulfillmentStatus,
  OrderPage,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
} from '@models/order.dto';
import { CustomerOrdersService } from '@services/customer-orders.service';
import { CustomerOrderStore } from '@stores/customer-order.store';

describe('CustomerOrderStore', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('loads customer orders list', () => {
    const mockPage: OrderPage = {
      items: [
        {
          id: 'ord-1',
          number: 'ORD-1001',
          status: OrderStatus.PendingPayment,
          paymentMethod: OrderPaymentMethod.Prepaid,
          total: 500000,
          currency: 'VND',
          createdOn: '2026-10-24T10:00:00Z',
          expiresAt: null,
          paymentStatus: OrderPaymentStatus.Unpaid,
          fulfillmentStatus: OrderFulfillmentStatus.Pending,
          paidAtUtc: null,
          recipientName: 'Khách hàng A',
          email: 'customer@example.com',
          phone: '0987654321',
        },
      ],
      total: 1,
      pageNumber: 1,
      pageSize: 20,
    };

    const service = {
      getMyOrders: vi.fn(() => of(mockPage)),
      getOrder: vi.fn(),
      checkout: vi.fn(),
      cancelOrder: vi.fn(),
      getDigitalDeliveries: vi.fn(),
      getMyShipments: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [CustomerOrderStore, { provide: CustomerOrdersService, useValue: service }],
    });

    const store = TestBed.inject(CustomerOrderStore);
    store.loadMyOrders();

    expect(service.getMyOrders).toHaveBeenCalledWith(1, 20);
    expect(store.myOrders().items).toHaveLength(1);
    expect(store.myOrders().items[0]?.number).toBe('ORD-1001');
  });

  it('loads order details and automatically loads digital deliveries if paid', () => {
    const mockOrder: OrderDto = {
      id: 'ord-1',
      number: 'ORD-1001',
      version: 'v1',
      status: OrderStatus.Completed,
      paymentMethod: OrderPaymentMethod.Prepaid,
      subtotal: 500000,
      discountCode: null,
      discountAmount: 0,
      shippingAmount: 0,
      total: 500000,
      currency: 'VND',
      expiresAt: null,
      recipientName: 'Khách hàng A',
      email: 'customer@example.com',
      phone: '0987654321',
      shippingAddress: null,
      items: [],
      paymentStatus: OrderPaymentStatus.Paid,
      fulfillmentStatus: OrderFulfillmentStatus.Completed,
      paidAtUtc: '2026-10-24T10:05:00Z',
      createdOn: '2026-10-24T10:00:00Z',
      physicalDispatchStarted: false,
    };

    const mockDeliveries = [
      { id: 'del-1', orderItemId: 'item-1', sequence: 1, content: 'KEY-ABCD-1234' },
    ];

    const service = {
      getMyOrders: vi.fn(),
      getOrder: vi.fn(() => of(mockOrder)),
      checkout: vi.fn(),
      cancelOrder: vi.fn(),
      getDigitalDeliveries: vi.fn(() => of(mockDeliveries)),
      getMyShipments: vi.fn(() => of([])),
    };

    TestBed.configureTestingModule({
      providers: [CustomerOrderStore, { provide: CustomerOrdersService, useValue: service }],
    });

    const store = TestBed.inject(CustomerOrderStore);
    store.loadOrder('ord-1');

    expect(service.getOrder).toHaveBeenCalledWith('ord-1');
    expect(service.getDigitalDeliveries).toHaveBeenCalledWith('ord-1');
    expect(store.isPaid()).toBe(true);
    expect(store.hasDigitalDeliveries()).toBe(true);
    expect(store.digitalDeliveries()[0]?.content).toBe('KEY-ABCD-1234');
  });
  it('keeps secondary failures distinct and ignores an old order response', () => {
    const old = new Subject<OrderDto>();
    const current = new Subject<OrderDto>();
    const api = {
      getOrder: vi.fn().mockReturnValueOnce(old).mockReturnValueOnce(current),
      getMyShipments: vi.fn(() => throwError(() => new Error('network'))),
      getDigitalDeliveries: vi.fn(() => throwError(() => new Error('network'))),
    };
    TestBed.configureTestingModule({
      providers: [CustomerOrderStore, { provide: CustomerOrdersService, useValue: api }],
    });
    const store = TestBed.inject(CustomerOrderStore);
    store.loadOrder('old');
    store.loadOrder('new');
    const order = { id: 'new', paymentStatus: OrderPaymentStatus.Paid } as OrderDto;
    current.next(order);
    old.next({ ...order, id: 'old' });
    expect(store.currentOrder()?.id).toBe('new');
    expect(store.detailError()).toBe('');
    expect(store.deliveriesError()).not.toBe('');
    expect(store.shipmentsError()).not.toBe('');
    store.stopOrderReads();
    expect(store.currentOrder()).toBeNull();
    expect(store.digitalDeliveries()).toEqual([]);
  });
});
