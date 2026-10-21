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

export interface RenewalContentDto {
  readonly id: string;
  readonly content: string;
}
