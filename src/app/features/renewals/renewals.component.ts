import { ButtonDirective } from 'primeng/button';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { Table } from 'primeng/table';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { StatusBadge } from '@shared/ui/status-badge/status-badge.component';
import { RenewalStatus } from '@models/renewal.dto';
import {
  RENEWAL_STATUS_FILTER_OPTIONS,
  RENEWAL_STATUS_LABELS,
  renewalStatusTone,
} from '@constants/renewal.constants';
import { RenewalsStore } from '@stores/renewals.store';

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
  readonly statusFilter = computed(() => this.store.selectedStatus()?.toString() ?? '');

  statusLabel(value: RenewalStatus): string {
    return RENEWAL_STATUS_LABELS[value];
  }

  routeQuery(): Record<string, string | number> {
    const rawPage = Number(this.route.snapshot.queryParams['page'] ?? 1);
    const rawStatus = Number(this.route.snapshot.queryParams['status']);
    const page = Number.isSafeInteger(rawPage) && rawPage > 1 ? rawPage : 1;
    const status = Object.values(RenewalStatus).includes(rawStatus as RenewalStatus)
      ? (rawStatus as RenewalStatus)
      : null;
    return { ...(page > 1 ? { page } : {}), ...(status !== null ? { status } : {}) };
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

  updateQuery(page: number, status: RenewalStatus | null): Promise<boolean> {
    const queryParams = { page: page > 1 ? page : null, status: status ?? null };
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
