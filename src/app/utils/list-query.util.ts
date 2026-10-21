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
  const fulfillment = positiveInteger(values['fulfillmentKind'], 0);
  const ids = ['categoryId', 'productTypeId'] as const;
  const price = (value: unknown): number | undefined => {
    if (typeof value !== 'string' || !/^\d+$/u.test(value)) return undefined;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
  };
  const minimumPrice = price(values['minimumPrice']);
  const maximumPrice = price(values['maximumPrice']);
  const sortBy = values['sortBy'];
  const sortDirection = values['sortDirection'];
  return {
    ...readListQuery(values),
    status: [1, 2, 3].includes(status) ? status : null,
    pageSize: [10, 20, 50].includes(pageSize) ? pageSize : 10,
    ...Object.fromEntries(
      ids.flatMap((key) => {
        const value = values[key];
        return typeof value === 'string' &&
          /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu.test(value)
          ? [[key, value.toLowerCase()]]
          : [];
      }),
    ),
    ...([1, 2, 3, 4].includes(fulfillment) ? { fulfillmentKind: fulfillment } : {}),
    ...(values['inStock'] === 'true' || values['inStock'] === 'false'
      ? { inStock: values['inStock'] === 'true' }
      : {}),
    ...(minimumPrice !== undefined ? { minimumPrice } : {}),
    ...(maximumPrice !== undefined ? { maximumPrice } : {}),
    ...(sortBy === 'name' || sortBy === 'price' ? { sortBy } : {}),
    ...(sortDirection === 'asc' ? { sortDirection } : {}),
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
    ...('pageSize' in query
      ? Object.fromEntries(
          (
            [
              'categoryId',
              'productTypeId',
              'fulfillmentKind',
              'inStock',
              'minimumPrice',
              'maximumPrice',
              'sortBy',
              'sortDirection',
            ] as const
          ).flatMap((key) => (query[key] === undefined ? [] : [[key, String(query[key])]])),
        )
      : {}),
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
