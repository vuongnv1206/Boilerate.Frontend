import { PaginationParams } from '@core/http/pagination';

export enum OutboxMessageStatus {
  Pending = 1,
  Processing = 2,
  Completed = 3,
  DeadLetter = 4,
}

export interface OutboxMessageDto {
  readonly messageId: string;
  readonly type: string;
  readonly schemaVersion: number;
  readonly occurredAt: string;
  readonly state: OutboxMessageStatus | string;
  readonly attempts: number;
  readonly nextAttemptAt: string;
  readonly leaseUntil: string | null;
  readonly lastError: string | null;
}

export interface OutboxFilter extends PaginationParams {
  readonly state?: OutboxMessageStatus | null;
  readonly size?: number;
}

interface OutboxStatusOption {
  readonly label: string;
  readonly value: OutboxMessageStatus | null;
}

export const OUTBOX_STATUS_OPTIONS: readonly OutboxStatusOption[] = [
  { label: 'Tất cả trạng thái', value: null },
  { label: 'Chờ xử lý', value: OutboxMessageStatus.Pending },
  { label: 'Đang xử lý', value: OutboxMessageStatus.Processing },
  { label: 'Hoàn tất', value: OutboxMessageStatus.Completed },
  { label: 'Lỗi (Dead-letter)', value: OutboxMessageStatus.DeadLetter },
];

export type OutboxBadgeTone = 'neutral' | 'success' | 'warning' | 'muted';
