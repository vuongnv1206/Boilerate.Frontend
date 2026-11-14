import { OutboxBadgeTone, OutboxMessageStatus } from './outbox.dto';

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
