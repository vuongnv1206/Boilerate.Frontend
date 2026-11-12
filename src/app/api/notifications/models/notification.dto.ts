import { PaginationParams } from '@core/base';

export enum BasicNotificationLabelType {
  Info = 1,
  Success = 2,
  Warning = 3,
  Error = 4,
}

export interface NotificationDto {
  readonly id: string;
  readonly userId?: string | null;
  readonly targetRole?: string | null;
  readonly title: string;
  readonly message: string;
  readonly type: BasicNotificationLabelType | string;
  readonly referenceType?: string | null;
  readonly referenceId?: string | null;
  readonly actionUrl?: string | null;
  readonly url?: string | null;
  readonly isRead: boolean;
  readonly readOn?: string | null;
  readonly createdOn: string;
}

export interface NotificationFilter extends PaginationParams {
  readonly pageNumber?: number;
  readonly isRead?: boolean | null;
}

interface NotificationFilterOption {
  readonly label: string;
  readonly value: boolean | null;
}

export const NOTIFICATION_FILTER_OPTIONS: readonly NotificationFilterOption[] = [
  { label: 'Tất cả thông báo', value: null },
  { label: 'Chưa đọc', value: false },
  { label: 'Đã đọc', value: true },
];

export type NotificationBadgeTone = 'neutral' | 'success' | 'warning' | 'muted';

function normalizeNotificationType(
  type: BasicNotificationLabelType | string,
): BasicNotificationLabelType {
  if (typeof type === 'number') {
    return type in BasicNotificationLabelType ? type : BasicNotificationLabelType.Info;
  }
  switch (type.trim().toLowerCase()) {
    case 'success':
    case '2':
      return BasicNotificationLabelType.Success;
    case 'warning':
    case '3':
      return BasicNotificationLabelType.Warning;
    case 'error':
    case '4':
      return BasicNotificationLabelType.Error;
    default:
      return BasicNotificationLabelType.Info;
  }
}

export function notificationTypeLabel(type: BasicNotificationLabelType | string): string {
  switch (normalizeNotificationType(type)) {
    case BasicNotificationLabelType.Success:
      return 'Thành công';
    case BasicNotificationLabelType.Warning:
      return 'Cảnh báo';
    case BasicNotificationLabelType.Error:
      return 'Lỗi';
    default:
      return 'Thông tin';
  }
}

export function notificationTypeTone(
  type: BasicNotificationLabelType | string,
): NotificationBadgeTone {
  switch (normalizeNotificationType(type)) {
    case BasicNotificationLabelType.Success:
      return 'success';
    case BasicNotificationLabelType.Warning:
    case BasicNotificationLabelType.Error:
      return 'warning';
    default:
      return 'neutral';
  }
}

export function resolveNotificationUrl(item: NotificationDto): string | null {
  const raw = (item.actionUrl ?? item.url ?? '').trim();
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return null;
  }
  return raw;
}
