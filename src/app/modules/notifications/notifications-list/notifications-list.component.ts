import { Component, OnInit, effect, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { BaseListComponent, PagedResult } from '@core/base';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { formatVnDateTime } from '@shared/utils/date.util';
import {
  BasicNotificationLabelType,
  NOTIFICATION_FILTER_OPTIONS,
  NotificationBadgeTone,
  NotificationDto,
  NotificationFilter,
  notificationTypeLabel,
  notificationTypeTone,
  resolveNotificationUrl,
} from '../models/notification.dto';
import { NotificationsService } from '../services/notifications.service';

@Component({
  selector: 'app-notifications-list',
  host: { class: 'collection-screen system-screen' },
  imports: [SHARED_IMPORTS],
  templateUrl: './notifications-list.component.html',
})
export class NotificationsListComponent
  extends BaseListComponent<NotificationDto, NotificationFilter>
  implements OnInit
{
  // System variables
  private initialized = false;

  // Business variables
  readonly filterOptions = NOTIFICATION_FILTER_OPTIONS;
  readonly unreadCount: NotificationsService['unreadCount'];

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly router: Router,
  ) {
    super();
    this.unreadCount = this.notificationsService.unreadCount;
    effect(() => {
      const version = this.notificationsService.liveVersion();
      if (version > 0 && this.initialized) {
        untracked(() => this.reload());
      }
    });
  }

  ngOnInit(): void {
    this.initialized = true;
    this.filter.set({ page: 1, pageSize: 20, isRead: null });
    this.notificationsService.refresh();
    this.reload();
  }

  onFilterChange(isRead: boolean | null): void {
    this.patchFilter({ isRead }, true);
  }

  markRead(item: NotificationDto): void {
    if (item.isRead || this.working()) return;
    this.run(this.notificationsService.markAsRead(item.id), {
      toastOnError: true,
      onSuccess: () => {
        this.items.update((list) =>
          list.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)),
        );
        if (this.filter().isRead === false) {
          this.reload();
        }
      },
    });
  }

  markAllRead(): void {
    if (this.working() || this.unreadCount() === 0) return;
    this.run(this.notificationsService.markAllAsRead(), {
      successMessage: 'Đã đánh dấu tất cả thông báo là đã đọc.',
      toastOnError: true,
      onSuccess: () => {
        this.reload();
      },
    });
  }

  remove(item: NotificationDto): void {
    if (this.working()) return;
    this.run(this.notificationsService.delete(item.id), {
      successMessage: 'Đã xóa thông báo.',
      toastOnError: true,
      onSuccess: () => {
        if (!item.isRead) {
          this.notificationsService.refresh();
        }
        this.reload();
      },
    });
  }

  openTarget(item: NotificationDto): void {
    const target = resolveNotificationUrl(item);
    if (!target) return;
    if (!item.isRead) {
      this.run(this.notificationsService.markAsRead(item.id), {
        onSuccess: () => {
          void this.router.navigateByUrl(target);
        },
        onError: () => {
          void this.router.navigateByUrl(target);
        },
      });
      return;
    }
    void this.router.navigateByUrl(target);
  }

  targetUrl(item: NotificationDto): string | null {
    return resolveNotificationUrl(item);
  }

  formatDateTime(value: string | null | undefined): string {
    return formatVnDateTime(value);
  }

  typeLabel(type: BasicNotificationLabelType | string): string {
    return notificationTypeLabel(type);
  }

  typeTone(type: BasicNotificationLabelType | string): NotificationBadgeTone {
    return notificationTypeTone(type);
  }

  protected override fetchList(
    filter: NotificationFilter,
  ): Observable<PagedResult<NotificationDto>> {
    return this.notificationsService.getPage(filter);
  }
}
