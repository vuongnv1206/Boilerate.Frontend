export enum RenewalStatus {
  AwaitingTarget = 1,
  Ready = 2,
  Claimed = 3,
  PendingVerification = 4,
  Completed = 5,
}

export enum RenewalOutcome {
  Pending = 1,
  Applied = 2,
  NotApplied = 3,
}

export interface RenewalDto {
  readonly id: string;
  readonly orderId: string;
  readonly orderItemId: string;
  readonly version: string;
  readonly status: RenewalStatus;
  readonly name: string;
  readonly sku: string;
  readonly optionDescription: string;
  readonly quantity: number;
  readonly targetPreview: string | null;
  readonly completedAtUtc: string | null;
  readonly verifiedExpiresAtUtc: string | null;
}

export interface RenewalAttemptDto {
  readonly id: string;
  readonly operationId: string;
  readonly startedBy: string;
  readonly startedAtUtc: string;
  readonly outcome: RenewalOutcome;
  readonly verifiedBy: string | null;
  readonly verifiedAtUtc: string | null;
  readonly newExpiresAtUtc: string | null;
}

export interface RenewalAdminDto {
  readonly renewal: RenewalDto;
  readonly claimedBy: string | null;
  readonly claimUntilUtc: string | null;
  readonly claimToken: string | null;
  readonly attempts: readonly RenewalAttemptDto[];
}

export interface RenewalHistoryDto {
  readonly operationId: string;
  readonly action: string;
  readonly actorId: string;
  readonly statusAfter: RenewalStatus;
  readonly occurredAtUtc: string;
}

export interface RenewalPage {
  readonly items: readonly RenewalAdminDto[];
  readonly total: number;
  readonly pageNumber: number;
  readonly pageSize: number;
}

export type RenewalQueue = 'awaiting-work' | 'pending-verification';

export interface RenewalListQuery {
  readonly page: number;
  readonly status: RenewalStatus | null;
  readonly queue: RenewalQueue | null;
}

export interface ClaimRenewalRequest {
  readonly version: string;
  readonly operationId: string;
}

export interface ReleaseRenewalRequest extends ClaimRenewalRequest {
  readonly claimToken: string;
}

export type StartRenewalRequest = ReleaseRenewalRequest;

export interface VerifyRenewalRequest {
  readonly version: string;
  readonly operationId: string;
  readonly attemptId: string;
  readonly applied: boolean;
  readonly newExpiresAtUtc: string | null;
  readonly note: string;
  readonly evidence: string | null;
}

export interface ProvisionRenewalsRequest {
  readonly orderVersion: string;
}

export interface SubmitRenewalTargetRequest {
  readonly version: string;
  readonly operationId: string;
  readonly accountIdentifier: string;
}

export interface RenewalContentDto {
  readonly id: string;
  readonly content: string;
}

export type RevealedRenewalTargetDto = RenewalContentDto;

export type RenewalCommand =
  | { readonly kind: 'claim'; readonly request: ClaimRenewalRequest }
  | { readonly kind: 'release'; readonly request: ReleaseRenewalRequest }
  | { readonly kind: 'start'; readonly request: StartRenewalRequest }
  | { readonly kind: 'verify'; readonly request: VerifyRenewalRequest };

export type RenewalCommandFailure = 'rejected' | 'uncertain' | null;

export type RenewalStatusBadgeTone = 'success' | 'warning' | 'neutral' | 'muted';

export interface RenewalOrderItemSnapshot {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly fulfillmentKind: number;
  readonly quantity: number;
}

export interface RenewalOrderSnapshot {
  readonly id: string;
  readonly version: string;
  readonly status: number;
  readonly paymentStatus: number;
  readonly items: readonly RenewalOrderItemSnapshot[];
}

export const RENEWAL_ORDER_STATUS = {
  Cancelled: 3,
  Expired: 4,
  Closed: 6,
} as const;

export const RENEWAL_PAYMENT_STATUS = {
  Paid: 2,
} as const;

export const RENEWAL_FULFILLMENT_KIND = {
  ManualExtension: 4,
} as const;

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

export function renewalStatusTone(status: RenewalStatus): RenewalStatusBadgeTone {
  if (status === RenewalStatus.Completed) return 'success';
  if (status === RenewalStatus.Claimed || status === RenewalStatus.PendingVerification) {
    return 'warning';
  }
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
