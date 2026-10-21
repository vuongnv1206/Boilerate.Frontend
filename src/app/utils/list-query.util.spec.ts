import { describe, expect, it } from 'vitest';
import {
  listQueryParams,
  readListQuery,
  readProductListQuery,
  sameQueryParams,
} from './list-query.util';
import { slugify } from './text.util';

describe('List URL state', () => {
  it('restores bookmark state and writes a canonical query without defaults', () => {
    const query = readProductListQuery({ q: ' ghế ', page: '2', pageSize: '20', status: '2' });
    expect(query).toEqual({ q: 'ghế', page: 2, pageSize: 20, status: 2 });
    expect(listQueryParams(query)).toEqual({ q: 'ghế', page: 2, pageSize: 20, status: 2 });
    expect(listQueryParams(readProductListQuery({}))).toEqual({});
    expect(sameQueryParams({ page: '2', q: 'ghế' }, { q: 'ghế', page: 2 })).toBe(true);
  });
  it.each(['0', '-1', '1.5', 'NaN', 'Infinity', '9007199254740993'])(
    'normalizes invalid page %s',
    (page) => {
      expect(readListQuery({ page }).page).toBe(1);
    },
  );
  it('rejects unsupported status and page size, arrays and unrelated query state', () => {
    expect(readProductListQuery({ q: ['a'], pageSize: '100', status: '99' })).toEqual({
      q: '',
      page: 1,
      pageSize: 10,
      status: null,
    });
    expect(sameQueryParams({ unused: 'value' }, {})).toBe(false);
  });
  it('normalizes Vietnamese text without imposing a domain length limit', () => {
    expect(slugify(' Đèn bàn / GỖ ĐẸP ')).toBe('den-ban-go-dep');
    expect(slugify('---')).toBe('');
  });
  it('round trips catalog filters without dropping zero and false', () => {
    const values = {
      categoryId: '20000000-0000-0000-0000-000000000001',
      productTypeId: '10000000-0000-0000-0000-000000000001',
      fulfillmentKind: '4',
      inStock: 'false',
      minimumPrice: '0',
      maximumPrice: '150000',
      sortBy: 'price',
      sortDirection: 'asc',
    };
    expect(listQueryParams(readProductListQuery(values))).toEqual(values);
    expect(
      listQueryParams(
        readProductListQuery({
          categoryId: 'not-an-id',
          minimumPrice: '-1',
          maximumPrice: ['10'],
          inStock: '0',
          sortBy: 'other',
          fulfillmentKind: '9',
        }),
      ),
    ).toEqual({});
  });
});
