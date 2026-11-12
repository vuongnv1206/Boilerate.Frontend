import { Component, OnInit, effect, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { BaseComponent } from '@core/base/base.component';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { pagedResult } from '@core/http/pagination';
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
} from '@api/notifications/models/notification.dto';
import { NotificationsService } from '@api/notifications/services/notifications.service';

@Component({
  selector: 'app-notifications-list',
  host: { class: 'collection-screen system-screen' },
  imports: [SHARED_IMPORTS],
  templateUrl: './notifications-list.component.html',
})
export class NotificationsListComponent extends BaseComponent implements OnInit {
  // System variables
  private initialized = false;
  private loadRequest?: Subscription;

  // Business variables
  readonly filterOptions = NOTIFICATION_FILTER_OPTIONS;
  readonly filter = signal<NotificationFilter>({ page: 1, pageSize: 20, isRead: null });
  readonly result = signal(pagedResult<NotificationDto>([], 0, 1, 20));
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
        untracked(() => this.loadData());
      }
    });
  }

  ngOnInit(): void {
    this.initialized = true;
    this.notificationsService.refresh();
    this.loadData();
  }

  loadData(): void {
    this.loadRequest?.unsubscribe();
    this.loading.set(true);
    this.errorMessage.set('');
    this.loadRequest = this.notificationsService
      .getPage(this.filter())
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) => this.errorMessage.set(normalizeApiError(error).message),
      });
  }

  changePage(page: number): void {
    this.filter.update((filter) => ({ ...filter, page: Math.max(1, page) }));
    this.loadData();
  }

  onFilterChange(isRead: boolean | null): void {
    this.filter.update((filter) => ({ ...filter, isRead, page: 1 }));
    this.loadData();
  }

  markRead(item: NotificationDto): void {
    if (item.isRead || this.working()) return;
    this.run(this.notificationsService.markAsRead(item.id), {
      toastOnError: true,
      onSuccess: () => {
        this.result.update((result) => ({
          ...result,
          items: result.items.map((entry) =>
            entry.id === item.id ? { ...entry, isRead: true } : entry,
          ),
        }));
        if (this.filter().isRead === false) {
          this.loadData();
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
        this.loadData();
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
        this.loadData();
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
}
