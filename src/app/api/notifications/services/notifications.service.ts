import { Inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { BaseApiService, PagedResult } from '@core/base';
import {
  NOTIFICATION_BADGE,
  NotificationBadgeState,
} from '@core/realtime/notification-badge.token';
import { NotificationDto, NotificationFilter } from '../models/notification.dto';

@Injectable({ providedIn: 'root' })
export class NotificationsService extends BaseApiService {
  // System variables
  readonly unreadCount: NotificationBadgeState['unreadCount'];
  readonly liveVersion: NotificationBadgeState['liveVersion'];

  constructor(@Inject(NOTIFICATION_BADGE) private readonly badge: NotificationBadgeState) {
    super();
    this.unreadCount = this.badge.unreadCount;
    this.liveVersion = this.badge.liveVersion;
  }

  refresh(): void {
    this.badge.refresh();
  }

  getPage(filter: NotificationFilter = {}): Observable<PagedResult<NotificationDto>> {
    const params: Record<string, unknown> = {
      pageNumber: filter.page ?? filter.pageNumber ?? 1,
      pageSize: filter.pageSize ?? 20,
      isRead: filter.isRead ?? undefined,
    };
    return this.getPageFrom<NotificationDto>('notifications', params);
  }

  markAsRead(id: string): Observable<void> {
    return this.put<void>(`notifications/${encodeURIComponent(id)}/read`, null).pipe(
      tap(() => this.badge.decrement(1)),
    );
  }

  markAllAsRead(): Observable<void> {
    return this.put<void>('notifications/read-all', null).pipe(tap(() => this.badge.clear()));
  }

  delete(id: string): Observable<void> {
    return this.deleteResource<void>(`notifications/${encodeURIComponent(id)}`);
  }
}
