import { Component, OnInit, computed, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseListComponent, PagedResult } from '@core/base';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { formatVnDateTime } from '@shared/utils/date.util';
import {
  OUTBOX_STATUS_OPTIONS,
  OutboxBadgeTone,
  OutboxFilter,
  OutboxMessageDto,
  OutboxMessageStatus,
  normalizeOutboxStatus,
  outboxStatusLabel,
  outboxStatusTone,
} from '../models/outbox.dto';
import { OutboxService } from '../services/outbox.service';

@Component({
  selector: 'app-outbox-list',
  host: { class: 'collection-screen system-screen' },
  imports: [SHARED_IMPORTS],
  templateUrl: './outbox-list.component.html',
})
export class OutboxListComponent
  extends BaseListComponent<OutboxMessageDto, OutboxFilter>
  implements OnInit
{
  // System variables
  readonly replayingId = signal<string | null>(null);
  readonly canReplay = computed(() => this.can('Outbox', 'Replay') || this.can('Outbox', 'Update'));

  // Business variables
  readonly statusOptions = OUTBOX_STATUS_OPTIONS;

  constructor(private readonly outboxService: OutboxService) {
    super();
  }

  ngOnInit(): void {
    this.filter.set({ state: null, page: 1, pageSize: 20 });
    this.reload();
  }

  onStatusChange(state: OutboxMessageStatus | null): void {
    this.patchFilter({ state }, true);
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
        this.reload();
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

  protected override fetchList(filter: OutboxFilter): Observable<PagedResult<OutboxMessageDto>> {
    return this.outboxService.getMessages(filter);
  }
}
