import { Component, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BaseComponent } from '@core/base';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  RENEWAL_QUEUE_LABELS,
  RENEWAL_STATUS_FILTER_OPTIONS,
  RENEWAL_STATUS_LABELS,
  RenewalQueue,
  RenewalStatus,
  readRenewalListQuery,
  renewalListQueryParams,
  renewalStatusTone,
} from '@api/renewals/models/renewal.dto';
import { RenewalsWorkspace } from '../renewals-workspace.component';

@Component({
  selector: 'app-renewals',
  host: { class: 'collection-screen' },
  imports: [SHARED_IMPORTS],
  templateUrl: './renewals.component.html',
})
export class Renewals extends BaseComponent {
  // Business variables
  readonly statuses = RENEWAL_STATUS_LABELS;
  readonly statusTone = renewalStatusTone;
  readonly statusOptions = RENEWAL_STATUS_FILTER_OPTIONS;
  readonly queueLabels = RENEWAL_QUEUE_LABELS;
  readonly statusFilter = computed(() => this.workspace.selectedStatus()?.toString() ?? '');

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    readonly workspace: RenewalsWorkspace,
  ) {
    super();
  }

  statusLabel(value: RenewalStatus): string {
    return RENEWAL_STATUS_LABELS[value];
  }

  routeQuery(): Record<string, string | number> {
    return renewalListQueryParams(readRenewalListQuery(this.route.snapshot.queryParams));
  }

  rangeStart(): number {
    const current = this.workspace.page();
    return current.total ? (current.pageNumber - 1) * current.pageSize + 1 : 0;
  }

  rangeEnd(): number {
    const current = this.workspace.page();
    return Math.min(current.total, current.pageNumber * current.pageSize);
  }

  async setStatus(value: string | null): Promise<void> {
    await this.updateQuery(
      1,
      value === '' || value === null ? null : (Number(value) as RenewalStatus),
    );
  }

  previous(): void {
    const current = this.workspace.page();
    if (current.pageNumber > 1) {
      void this.updateQuery(current.pageNumber - 1, this.workspace.selectedStatus());
    }
  }

  next(): void {
    const current = this.workspace.page();
    if (current.pageNumber < this.workspace.pageCount()) {
      void this.updateQuery(current.pageNumber + 1, this.workspace.selectedStatus());
    }
  }

  clearQueue(): void {
    void this.updateQuery(1, this.workspace.selectedStatus(), null);
  }

  updateQuery(
    page: number,
    status: RenewalStatus | null,
    queue: RenewalQueue | null = this.workspace.selectedQueue(),
  ): Promise<boolean> {
    const queryParams = renewalListQueryParams({ page, status, queue });
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
    });
  }
}
