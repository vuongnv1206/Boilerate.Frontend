import { PaginationParams } from '@core/http/pagination';

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
