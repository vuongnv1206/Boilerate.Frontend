import { PaginationParams } from '@core/base';

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

export function normalizeOutboxStatus(
  state: OutboxMessageStatus | string,
): OutboxMessageStatus | null {
  if (typeof state === 'number') {
    return state in OutboxMessageStatus ? state : null;
  }
  switch (state.trim().toLowerCase()) {
    case 'pending':
    case '1':
      return OutboxMessageStatus.Pending;
    case 'processing':
    case '2':
      return OutboxMessageStatus.Processing;
    case 'completed':
    case '3':
      return OutboxMessageStatus.Completed;
    case 'deadletter':
    case 'dead_letter':
    case '4':
      return OutboxMessageStatus.DeadLetter;
    default:
      return null;
  }
}

export function outboxStatusLabel(state: OutboxMessageStatus | string): string {
  switch (normalizeOutboxStatus(state)) {
    case OutboxMessageStatus.Pending:
      return 'Chờ xử lý';
    case OutboxMessageStatus.Processing:
      return 'Đang xử lý';
    case OutboxMessageStatus.Completed:
      return 'Hoàn tất';
    case OutboxMessageStatus.DeadLetter:
      return 'Dead-letter';
    default:
      return String(state);
  }
}

export function outboxStatusTone(state: OutboxMessageStatus | string): OutboxBadgeTone {
  switch (normalizeOutboxStatus(state)) {
    case OutboxMessageStatus.Completed:
      return 'success';
    case OutboxMessageStatus.DeadLetter:
      return 'warning';
    case OutboxMessageStatus.Processing:
      return 'neutral';
    default:
      return 'muted';
  }
}
