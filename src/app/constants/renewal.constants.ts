import { RenewalOutcome, RenewalStatus } from '@models/renewal.dto';

export const RENEWAL_STATUS_LABELS: Readonly<Record<RenewalStatus, string>> = {
  [RenewalStatus.AwaitingTarget]: 'Chờ thông tin tài khoản',
  [RenewalStatus.Ready]: 'Sẵn sàng gia hạn',
  [RenewalStatus.Claimed]: 'Đang được nhận xử lý',
  [RenewalStatus.PendingVerification]: 'Chờ xác minh',
  [RenewalStatus.Completed]: 'Đã gia hạn',
};

export const RENEWAL_OUTCOME_LABELS: Readonly<Record<RenewalOutcome, string>> = {
  [RenewalOutcome.Pending]: 'Chờ xác minh',
  [RenewalOutcome.Applied]: 'Đã áp dụng',
  [RenewalOutcome.NotApplied]: 'Chưa áp dụng',
};

export const RENEWAL_STATUS_OPTIONS = Object.entries(RENEWAL_STATUS_LABELS).map(
  ([value, label]) => ({ value: Number(value) as RenewalStatus, label }),
);

export const RENEWAL_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Mọi trạng thái' },
  ...RENEWAL_STATUS_OPTIONS.map((item) => ({ ...item, value: String(item.value) })),
];
