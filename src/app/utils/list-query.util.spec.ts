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
});
