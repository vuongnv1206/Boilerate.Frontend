import { Component, computed } from '@angular/core';
import { BaseComponent } from '@core/base';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  RENEWAL_QUEUE_LABELS,
  RENEWAL_STATUS_FILTER_OPTIONS,
  RENEWAL_STATUS_LABELS,
  RenewalStatus,
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

  constructor(readonly workspace: RenewalsWorkspace) {
    super();
  }

  statusLabel(value: RenewalStatus): string {
    return RENEWAL_STATUS_LABELS[value];
  }

  routeQuery(): Record<string, string | number> {
    return this.workspace.routeQuery();
  }

  rangeStart(): number {
    return this.workspace.rangeStart();
  }

  rangeEnd(): number {
    return this.workspace.rangeEnd();
  }

  setStatus(value: string | null): void {
    const status = value === '' || value === null ? null : (Number(value) as RenewalStatus);
    this.workspace.patchQuery({ status }, { resetPage: true });
  }

  previous(): void {
    const current = this.workspace.page();
    if (current.pageNumber > 1) {
      this.workspace.setPage(current.pageNumber - 1);
    }
  }

  next(): void {
    const current = this.workspace.page();
    if (current.pageNumber < this.workspace.pageCount()) {
      this.workspace.setPage(current.pageNumber + 1);
    }
  }

  clearQueue(): void {
    this.workspace.patchQuery({ queue: null }, { resetPage: true });
  }
}
