import { describe, expect, it } from 'vitest';
import {
  adminOverviewQueryParams,
  defaultAdminOverviewQuery,
  overviewDateString,
  overviewDateValue,
  overviewRangeError,
  overviewToday,
  readAdminOverviewQuery,
} from './admin-overview-query.util';
import { formatOverviewMoney, overviewChart } from './admin-overview-chart.util';

describe('Overview reporting dates and URL state', () => {
  it('switches business dates at Vietnam midnight regardless of browser timezone', () => {
    expect(overviewToday(new Date('2026-10-25T16:59:59Z'))).toBe('2026-10-25');
    expect(overviewToday(new Date('2026-10-25T17:00:00Z'))).toBe('2026-10-26');
    expect(defaultAdminOverviewQuery('2026-10-26').from).toBe('2026-10-20');
  });

  it('allows exactly 90 inclusive days and rejects invalid, future or reversed dates', () => {
    expect(overviewRangeError('2026-07-29', '2026-10-26', '2026-10-26')).toBe('');
    for (const [from, to] of [
      ['2026-07-28', '2026-10-26'],
      ['2026-02-30', '2026-03-01'],
      ['2026-10-26', '2026-10-25'],
      ['2026-10-26', '2026-10-27'],
      ['0001-01-01', '0001-01-01'],
    ]) {
      expect(overviewRangeError(from ?? '', to ?? '', '2026-10-26')).not.toBe('');
    }
  });

  it('round trips dates and zero threshold with independent stock pagination', () => {
    const values = {
      from: '2026-10-01',
      to: '2026-10-07',
      threshold: '0',
      page: '3',
      pageSize: '20',
    };
    const query = readAdminOverviewQuery(values, '2026-10-26');
    expect(adminOverviewQueryParams(query)).toEqual({
      ...values,
      threshold: 0,
      page: 3,
      pageSize: 20,
    });
    expect(overviewDateString(overviewDateValue('0099-10-01'))).toBe('0099-10-01');
  });

  it('normalizes invalid ranges and unsafe offsets before requesting the API', () => {
    const query = readAdminOverviewQuery(
      {
        from: '2026-01-01',
        to: '2026-10-26',
        threshold: '1000',
        page: '9007199254740991',
        pageSize: '50',
      },
      '2026-10-26',
    );
    expect(query).toEqual({ ...defaultAdminOverviewQuery('2026-10-26'), pageSize: 50 });
  });
});

describe('Overview exact monetary labels and SVG coordinates', () => {
  it('preserves integer amounts above the JavaScript number boundary', () => {
    expect(formatOverviewMoney('9007199254740993')).toContain('9.007.199.254.740.993');
    expect(formatOverviewMoney('-9007199254740993')).toContain('-9.007.199.254.740.993');
  });

  it('plots negative net and zero days without NaN and retains exact accessible labels', () => {
    const chart = overviewChart([
      { date: '2026-10-25', received: '0', refunded: '9007199254740993', net: '-9007199254740993' },
      { date: '2026-10-26', received: '0', refunded: '0', net: '0' },
    ]);
    expect(chart.bars[0]?.label).toContain('-9.007.199.254.740.993');
    expect(chart.netPoints).not.toMatch(/NaN|Infinity/u);
    expect(chart.zeroY).toBeLessThan(206);
    expect(overviewChart([]).bars).toEqual([]);
    expect(
      overviewChart([{ date: '2026-10-26', received: '0', refunded: '0', net: '0' }]).netPoints,
    ).not.toMatch(/NaN|Infinity/u);
  });
});
