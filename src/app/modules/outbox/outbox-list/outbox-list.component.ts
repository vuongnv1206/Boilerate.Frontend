import { Component, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize } from 'rxjs';
import { BaseComponent } from '@core/base/base.component';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { pagedResult } from '@core/http/pagination';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { formatVnDateTime } from '@shared/utils/date.util';
import {
  OUTBOX_STATUS_OPTIONS,
  OutboxBadgeTone,
  OutboxFilter,
  OutboxMessageDto,
  OutboxMessageStatus,
} from '@api/outbox/models/outbox.dto';
import {
  normalizeOutboxStatus,
  outboxStatusLabel,
  outboxStatusTone,
} from '@api/outbox/models/outbox.util';
import { OutboxService } from '@api/outbox/services/outbox.service';

@Component({
  selector: 'app-outbox-list',
  host: { class: 'collection-screen system-screen' },
  imports: [SHARED_IMPORTS],
  templateUrl: './outbox-list.component.html',
})
export class OutboxListComponent extends BaseComponent implements OnInit {
  // System variables
  readonly replayingId = signal<string | null>(null);
  private loadRequest?: Subscription;
  readonly canReplay = computed(() => this.can('Outbox', 'Replay') || this.can('Outbox', 'Update'));

  // Business variables
  readonly statusOptions = OUTBOX_STATUS_OPTIONS;
  readonly filter = signal<OutboxFilter>({ state: null, page: 1, pageSize: 20 });
  readonly result = signal(pagedResult<OutboxMessageDto>([], 0, 1, 20));

  constructor(private readonly outboxService: OutboxService) {
    super();
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loadRequest?.unsubscribe();
    this.loading.set(true);
    this.errorMessage.set('');
    this.loadRequest = this.outboxService
      .getMessages(this.filter())
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

  onStatusChange(state: OutboxMessageStatus | null): void {
    this.filter.update((filter) => ({ ...filter, state, page: 1 }));
    this.loadData();
  }

  canReplayRow(item: OutboxMessageDto): boolean {
    if (!this.canReplay()) return false;
    const normalized = normalizeOutboxStatus(item.state);
    return (
      normalized === OutboxMessageStatus.DeadLetter || normalized === OutboxMessageStatus.Pending
    );
  }

  replayMessage(item: OutboxMessageDto): void {
    if (!this.canReplay() || this.working()) return;
    this.replayingId.set(item.messageId);
    this.run(this.outboxService.replay(item.messageId), {
      toastOnError: true,
      onSuccess: () => {
        this.replayingId.set(null);
        this.toast.success('Đã đưa sự kiện vào hàng đợi phát lại.');
        this.loadData();
      },
      onError: () => {
        this.replayingId.set(null);
      },
    });
  }

  formatDateTime(value: string | null | undefined): string {
    return formatVnDateTime(value);
  }

  statusLabel(state: OutboxMessageStatus | string): string {
    return outboxStatusLabel(state);
  }

  statusTone(state: OutboxMessageStatus | string): OutboxBadgeTone {
    return outboxStatusTone(state);
  }
}
