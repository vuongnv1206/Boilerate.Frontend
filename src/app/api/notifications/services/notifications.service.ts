import { Inject, Injectable } from '@angular/core';
import { Observable, tap, map } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import {
  NOTIFICATION_BADGE,
  NotificationBadgeState,
} from '@core/realtime/notification-badge.token';
import { PagedResult, PaginationResponse, fromPaginationResponse } from '@core/http/pagination';
import { NotificationDto, NotificationFilter } from '../models/notification.dto';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  // System variables
  readonly unreadCount: NotificationBadgeState['unreadCount'];
  readonly liveVersion: NotificationBadgeState['liveVersion'];

  constructor(
    private readonly api: ApiService,
    @Inject(NOTIFICATION_BADGE) private readonly badge: NotificationBadgeState,
  ) {
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
    return this.api
      .get<PaginationResponse<NotificationDto>>('notifications', params)
      .pipe(map(fromPaginationResponse));
  }

  markAsRead(id: string): Observable<void> {
    return this.api
      .put<void>(`notifications/${encodeURIComponent(id)}/read`, null)
      .pipe(tap(() => this.badge.decrement(1)));
  }

  markAllAsRead(): Observable<void> {
    return this.api.put<void>('notifications/read-all', null).pipe(tap(() => this.badge.clear()));
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`notifications/${encodeURIComponent(id)}`);
  }
}
