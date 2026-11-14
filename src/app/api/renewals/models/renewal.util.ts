import { RenewalListQuery, RenewalQueue, RenewalStatus } from './renewal.dto';

type RenewalStatusBadgeTone = 'success' | 'warning' | 'neutral' | 'muted';

export function renewalStatusTone(status: RenewalStatus): RenewalStatusBadgeTone {
  if (status === RenewalStatus.Completed) return 'success';
  if (status === RenewalStatus.Claimed || status === RenewalStatus.PendingVerification) {
    return 'warning';
  }
  if (status === RenewalStatus.AwaitingTarget) return 'muted';
  return 'neutral';
}

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
