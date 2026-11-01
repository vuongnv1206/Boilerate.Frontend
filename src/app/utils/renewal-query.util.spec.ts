import { describe, expect, it } from 'vitest';
import { readRenewalListQuery, renewalListQueryParams } from './renewal-query.util';

describe('Renewal queue URL state', () => {
  it('preserves queue and status through detail navigation and paging', () => {
    const query = readRenewalListQuery({ queue: 'awaiting-work', status: '3', page: '4' });
    expect(renewalListQueryParams(query)).toEqual({ queue: 'awaiting-work', status: 3, page: 4 });
  });

  it('canonicalizes unknown queue and invalid status/page without widening a known queue', () => {
    expect(
      renewalListQueryParams(readRenewalListQuery({ queue: 'bad', status: '999', page: '-4' })),
    ).toEqual({});
    expect(
      renewalListQueryParams(
        readRenewalListQuery({ queue: 'pending-verification', status: 'bad' }),
      ),
    ).toEqual({ queue: 'pending-verification' });
  });
});
