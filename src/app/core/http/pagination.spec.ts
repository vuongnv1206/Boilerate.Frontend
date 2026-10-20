import { describe, expect, it } from 'vitest';
import { paginationParams } from './pagination';

describe('Pagination wire parameters', () => {
  it('retains one-based page numbering without a hidden UI conversion', () => {
    const params = paginationParams({ pageNumber: 1, pageSize: 20 });
    expect(params.get('pageNumber')).toBe('1');
    expect(params.get('pageSize')).toBe('20');
  });

  it.each([
    { pageNumber: 0, pageSize: 20 },
    { pageNumber: -1, pageSize: 20 },
    { pageNumber: 1.5, pageSize: 20 },
    { pageNumber: 1, pageSize: 0 },
    { pageNumber: 1, pageSize: Number.NaN },
  ])('rejects invalid page requests (%#)', (request) => {
    expect(() => paginationParams(request)).toThrow();
  });
});
