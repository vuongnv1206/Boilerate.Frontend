import { describe, expect, it } from 'vitest';
import { orderListQueryParams, readOrderListQuery } from './order-query.util';

describe('Order queue URL state', () => {
  it('keeps a known queue together with independent filters and page through serialization', () => {
    const query = readOrderListQuery({
      queue: 'needs-review',
      q: 'ORD-7',
      paymentStatus: '2',
      page: '3',
    });
    expect(orderListQueryParams(query)).toEqual({
      queue: 'needs-review',
      q: 'ORD-7',
      paymentStatus: 2,
      page: 3,
    });
  });

  it('drops an unknown queue while keeping valid filters', () => {
    const query = readOrderListQuery({ queue: 'all-data', status: '2' });
    expect(query.queue).toBeNull();
    expect(orderListQueryParams(query)).toEqual({ status: 2 });
  });
});
