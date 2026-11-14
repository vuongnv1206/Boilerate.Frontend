import {
  BasicNotificationLabelType,
  NotificationBadgeTone,
  NotificationDto,
} from './notification.dto';

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
