import { RenewalListQuery, RenewalQueue, RenewalStatus } from '@models/renewal.dto';

export function readRenewalListQuery(values: Readonly<Record<string, unknown>>): RenewalListQuery {
  const rawPage = typeof values['page'] === 'string' ? Number(values['page']) : NaN;
  const rawStatus = typeof values['status'] === 'string' ? Number(values['status']) : NaN;
  const rawQueue = values['queue'];
  return {
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    status: [1, 2, 3, 4, 5].includes(rawStatus) ? (rawStatus as RenewalStatus) : null,
    queue:
      rawQueue === 'awaiting-work' || rawQueue === 'pending-verification'
        ? (rawQueue as RenewalQueue)
        : null,
  };
}

export function renewalListQueryParams(query: RenewalListQuery): Record<string, string | number> {
  return {
    ...(query.page > 1 ? { page: query.page } : {}),
    ...(query.status === null ? {} : { status: query.status }),
    ...(query.queue ? { queue: query.queue } : {}),
  };
}

export function sameRenewalQueryParams(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean {
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => String(left[key]) === String(right[key]))
  );
}
