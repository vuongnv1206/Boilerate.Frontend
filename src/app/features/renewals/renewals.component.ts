import { ButtonDirective } from 'primeng/button';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { Table } from 'primeng/table';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { StatusBadge } from '@shared/ui/status-badge/status-badge.component';
import { RenewalQueue, RenewalStatus } from '@models/renewal.dto';
import {
  RENEWAL_STATUS_FILTER_OPTIONS,
  RENEWAL_STATUS_LABELS,
  RENEWAL_QUEUE_LABELS,
  renewalStatusTone,
} from '@constants/renewal.constants';
import { RenewalsStore } from '@stores/renewals.store';
import { readRenewalListQuery, renewalListQueryParams } from '@utils/renewal-query.util';

@Component({
  selector: 'app-renewals',
  host: { class: 'collection-screen' },
  imports: [
    RouterLink,
    ContentState,
    Icon,
    StatusBadge,
    FormsModule,
    Select,
    Table,
    ButtonDirective,
  ],
  templateUrl: './renewals.component.html',
  styleUrl: '../../../styles/admin/_renewals.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Renewals {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly store = inject(RenewalsStore);
  readonly statuses = RENEWAL_STATUS_LABELS;
  readonly statusTone = renewalStatusTone;
  readonly statusOptions = RENEWAL_STATUS_FILTER_OPTIONS;
  readonly queueLabels = RENEWAL_QUEUE_LABELS;
  readonly statusFilter = computed(() => this.store.selectedStatus()?.toString() ?? '');

  statusLabel(value: RenewalStatus): string {
    return RENEWAL_STATUS_LABELS[value];
  }

  routeQuery(): Record<string, string | number> {
    return renewalListQueryParams(readRenewalListQuery(this.route.snapshot.queryParams));
  }

  rangeStart(): number {
    return this.store.page().total
      ? (this.store.page().pageNumber - 1) * this.store.page().pageSize + 1
      : 0;
  }

  rangeEnd(): number {
    return Math.min(
      this.store.page().total,
      this.store.page().pageNumber * this.store.page().pageSize,
    );
  }

  async setStatus(value: string | null): Promise<void> {
    await this.updateQuery(
      1,
      value === '' || value === null ? null : (Number(value) as RenewalStatus),
    );
  }

  previous(): void {
    if (this.store.page().pageNumber > 1)
      void this.updateQuery(this.store.page().pageNumber - 1, this.store.selectedStatus());
  }

  next(): void {
    if (this.store.page().pageNumber < this.store.pageCount())
      void this.updateQuery(this.store.page().pageNumber + 1, this.store.selectedStatus());
  }

  clearQueue(): void {
    void this.updateQuery(1, this.store.selectedStatus(), null);
  }

  updateQuery(
    page: number,
    status: RenewalStatus | null,
    queue: RenewalQueue | null = this.store.selectedQueue(),
  ): Promise<boolean> {
    const queryParams = renewalListQueryParams({ page, status, queue });
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
    });
  }
}
