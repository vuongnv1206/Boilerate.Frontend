import { RenewalOutcome, RenewalQueue, RenewalStatus } from '@models/renewal.dto';

export const RENEWAL_QUEUE_LABELS: Readonly<Record<RenewalQueue, string>> = {
  'awaiting-work': 'Gia hạn chờ thực hiện',
  'pending-verification': 'Gia hạn chờ xác minh',
};

export const RENEWAL_STATUS_LABELS: Readonly<Record<RenewalStatus, string>> = {
  [RenewalStatus.AwaitingTarget]: 'Chờ khách nhập tài khoản',
  [RenewalStatus.Ready]: 'Chờ nhận xử lý',
  [RenewalStatus.Claimed]: 'Đang xử lý',
  [RenewalStatus.PendingVerification]: 'Chờ xác minh kết quả',
  [RenewalStatus.Completed]: 'Đã xác nhận gia hạn',
};

export function renewalStatusTone(
  status: RenewalStatus,
): 'success' | 'warning' | 'neutral' | 'muted' {
  if (status === RenewalStatus.Completed) return 'success';
  if (status === RenewalStatus.Claimed || status === RenewalStatus.PendingVerification)
    return 'warning';
  if (status === RenewalStatus.AwaitingTarget) return 'muted';
  return 'neutral';
}

export const RENEWAL_OUTCOME_LABELS: Readonly<Record<RenewalOutcome, string>> = {
  [RenewalOutcome.Pending]: 'Chờ xác minh kết quả',
  [RenewalOutcome.Applied]: 'Đã gia hạn',
  [RenewalOutcome.NotApplied]: 'Chưa gia hạn',
};

export const RENEWAL_STATUS_OPTIONS = Object.entries(RENEWAL_STATUS_LABELS).map(
  ([value, label]) => ({ value: Number(value) as RenewalStatus, label }),
);

export const RENEWAL_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Mọi trạng thái' },
  ...RENEWAL_STATUS_OPTIONS.map((item) => ({ ...item, value: String(item.value) })),
];
