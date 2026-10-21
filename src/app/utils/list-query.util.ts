import { ListQuery, ProductListQuery } from '@models/list-query.model';

type QueryValues = Readonly<Record<string, unknown>>;

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function readListQuery(values: QueryValues): ListQuery {
  return {
    q: typeof values['q'] === 'string' ? values['q'].trim() : '',
    page: positiveInteger(values['page'], 1),
  };
}

export function readProductListQuery(values: QueryValues): ProductListQuery {
  const status = positiveInteger(values['status'], 0);
  const pageSize = positiveInteger(values['pageSize'], 10);
  return {
    ...readListQuery(values),
    status: [1, 2, 3].includes(status) ? status : null,
    pageSize: [10, 20, 50].includes(pageSize) ? pageSize : 10,
  };
}

export function listQueryParams(
  query: ListQuery | ProductListQuery,
): Record<string, string | number> {
  return {
    ...(query.q ? { q: query.q } : {}),
    ...(query.page > 1 ? { page: query.page } : {}),
    ...('status' in query && query.status !== null ? { status: query.status } : {}),
    ...('pageSize' in query && query.pageSize !== 10 ? { pageSize: query.pageSize } : {}),
  };
}

export function sameQueryParams(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean {
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => String(left[key]) === String(right[key]))
  );
}
