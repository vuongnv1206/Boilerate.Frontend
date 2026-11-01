import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Table } from 'primeng/table';
import { AuthSession } from '@core/auth/auth-session';
import {
  OVERVIEW_MAX_THRESHOLD,
  OVERVIEW_PAGE_SIZES,
  OVERVIEW_RANGE_OPTIONS,
  OVERVIEW_WORK_DESCRIPTIONS,
  OVERVIEW_WORK_LABELS,
} from '@constants/admin-overview.constants';
import { ORDER_STATUS_LABELS } from '@constants/order.constants';
import { RENEWAL_STATUS_LABELS } from '@constants/renewal.constants';
import {
  AdminOverviewQuery,
  OverviewRangePreset,
  OverviewWorkGroup,
  OverviewWorkItem,
  OverviewWorkKey,
} from '@models/admin-overview.dto';
import { OrderStatus, ProductFulfillmentKind } from '@models/order.dto';
import { RenewalStatus } from '@models/renewal.dto';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { StatusBadge } from '@shared/ui/status-badge/status-badge.component';
import { AdminOverviewStore } from '@stores/admin-overview.store';
import { formatOverviewMoney, overviewChart } from '@utils/admin-overview-chart.util';
import {
  adminOverviewQueryParams,
  defaultAdminOverviewQuery,
  overviewAddDays,
  overviewDateString,
  overviewDateValue,
  overviewRangeError,
  overviewRangePreset,
  overviewToday,
  readAdminOverviewQuery,
} from '@utils/admin-overview-query.util';

@Component({
  selector: 'app-overview',
  standalone: true,
  host: { class: 'collection-screen' },
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    ButtonDirective,
    DatePicker,
    InputText,
    Select,
    Table,
    ContentState,
    Icon,
    StatusBadge,
  ],
  providers: [AdminOverviewStore],
  templateUrl: './overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Overview implements OnInit {
  readonly store = inject(AdminOverviewStore);
  private readonly session = inject(AuthSession);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly todayState = signal(overviewToday(new Date()));
  readonly rangeOptions = [...OVERVIEW_RANGE_OPTIONS];
  readonly pageSizes = OVERVIEW_PAGE_SIZES.map((value) => ({ label: String(value), value }));
  readonly workLabels = OVERVIEW_WORK_LABELS;
  readonly workDescriptions = OVERVIEW_WORK_DESCRIPTIONS;
  readonly selectedWorkKey = signal<OverviewWorkKey | null>(null);
  readonly preset = signal<OverviewRangePreset>('7');
  readonly fromDraft = signal<Date | null>(
    overviewDateValue(defaultAdminOverviewQuery(this.todayState()).from),
  );
  readonly toDraft = signal<Date | null>(overviewDateValue(this.todayState()));
  readonly thresholdDraft = signal<number | null>(5);
  readonly showDailyData = signal(false);
  readonly maxDate = computed(() => overviewDateValue(this.todayState()) ?? new Date());
  readonly canOpenProduct = computed(() => this.session.can('Product', 'View'));
  readonly workGroups = computed(
    () =>
      this.store
        .work()
        .data?.groups.filter((group) =>
          this.session.can(group.kind === 'order' ? 'Order' : 'Renewal', 'View'),
        ) ?? [],
  );
  readonly selectedWork = computed(
    () =>
      this.workGroups().find((group) => group.key === this.selectedWorkKey()) ??
      this.workGroups()[0] ??
      null,
  );
  readonly selectedWorkItems = computed(() => [...(this.selectedWork()?.items ?? [])]);
  readonly financeDays = computed(() => [...(this.store.finance().data?.days ?? [])]);
  readonly stockItems = computed(() => [...(this.store.stock().data?.items ?? [])]);
  readonly chart = computed(() => overviewChart(this.financeDays()));
  readonly rangeError = computed(() =>
    overviewRangeError(
      overviewDateString(this.fromDraft()),
      overviewDateString(this.toDraft()),
      this.todayState(),
    ),
  );
  readonly thresholdError = computed(() => {
    const value = this.thresholdDraft();
    return value === null || !Number.isInteger(value) || value < 0 || value > OVERVIEW_MAX_THRESHOLD
      ? `Nhập số nguyên từ 0 đến ${OVERVIEW_MAX_THRESHOLD}.`
      : '';
  });
  readonly hasVisibleSection = computed(
    () => this.store.workVisible() || this.store.financeVisible() || this.store.stockVisible(),
  );

  constructor() {
    effect(() => {
      const page = this.store.stockPageCorrection();
      if (page !== null) untracked(() => this.updateQuery({ ...this.store.query(), page }, true));
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const values = Object.fromEntries(params.keys.map((key) => [key, params.get(key)]));
      const query = readAdminOverviewQuery(values, this.todayState());
      const canonical = adminOverviewQueryParams(query);
      if (!sameParams(values, canonical)) {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: canonical,
          replaceUrl: true,
        });
        return;
      }
      this.preset.set(overviewRangePreset(query, this.todayState()));
      this.fromDraft.set(overviewDateValue(query.from));
      this.toDraft.set(overviewDateValue(query.to));
      this.thresholdDraft.set(query.threshold);
      this.store.applyQuery(query);
    });
  }

  refresh(): void {
    this.todayState.set(overviewToday(new Date()));
    this.store.refresh();
  }

  setPreset(value: OverviewRangePreset): void {
    this.preset.set(value);
    if (value === 'custom') return;
    const days = value === 'today' ? 1 : Number(value);
    const to = this.todayState();
    this.updateQuery({ ...this.store.query(), from: overviewAddDays(to, -(days - 1)), to });
  }

  setFromDate(value: Date | null): void {
    this.fromDraft.set(value);
  }

  setToDate(value: Date | null): void {
    this.toDraft.set(value);
  }

  applyDates(): void {
    if (this.rangeError()) return;
    this.updateQuery({
      ...this.store.query(),
      from: overviewDateString(this.fromDraft()),
      to: overviewDateString(this.toDraft()),
    });
  }

  setThreshold(value: number | string | null): void {
    this.thresholdDraft.set(value === null || value === '' ? null : Number(value));
  }

  applyThreshold(): void {
    const threshold = this.thresholdDraft();
    if (threshold === null || this.thresholdError()) return;
    this.updateQuery({ ...this.store.query(), threshold, page: 1 });
  }

  setPage(page: number): void {
    if (page < 1 || page > this.store.stockPageCount()) return;
    this.updateQuery({ ...this.store.query(), page });
  }

  setPageSize(pageSize: number): void {
    if (!OVERVIEW_PAGE_SIZES.some((value) => value === pageSize)) return;
    this.updateQuery({ ...this.store.query(), pageSize, page: 1 });
  }

  workListPath(group: OverviewWorkGroup): string {
    return group.kind === 'order' ? '/admin/orders' : '/admin/renewals';
  }

  workQueue(group: OverviewWorkGroup): string {
    return group.key.startsWith('renewal-') ? group.key.slice('renewal-'.length) : group.key;
  }

  workItemPath(group: OverviewWorkGroup, item: OverviewWorkItem): string[] {
    return [group.kind === 'order' ? '/admin/orders' : '/admin/renewals', item.id];
  }

  workStatus(group: OverviewWorkGroup, item: OverviewWorkItem): string {
    return (
      (group.kind === 'order'
        ? ORDER_STATUS_LABELS[item.status as OrderStatus]
        : RENEWAL_STATUS_LABELS[item.status as RenewalStatus]) ?? 'Không xác định'
    );
  }

  stockKind(kind: ProductFulfillmentKind): string {
    if (kind === ProductFulfillmentKind.DigitalUnique) return 'Hàng số Unique';
    if (kind === ProductFulfillmentKind.DigitalShared) return 'Nội dung Shared';
    return 'Hàng vật lý';
  }

  money(value: string): string {
    return formatOverviewMoney(value);
  }

  private updateQuery(query: AdminOverviewQuery, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: adminOverviewQueryParams(query),
      replaceUrl,
    });
  }
}

function sameParams(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean {
  return (
    Object.keys(left).length === Object.keys(right).length &&
    Object.keys(right).every((key) => String(left[key]) === String(right[key]))
  );
}
