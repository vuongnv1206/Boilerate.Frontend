import {
  Component,
  OnInit,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  OVERVIEW_MAX_THRESHOLD,
  OVERVIEW_PAGE_SIZES,
  OVERVIEW_PAGE_SIZE_OPTIONS,
  OverviewFulfillmentKind,
  OverviewSection,
  OverviewStock,
  OverviewStockQueryInput,
  getOverviewStockKindLabel,
} from '../../models/overview.dto';

@Component({
  selector: 'app-overview-stock-panel',
  host: { style: 'display: contents' },
  imports: [SHARED_IMPORTS],
  templateUrl: './overview-stock-panel.component.html',
})
export class OverviewStockPanelComponent implements OnInit {
  // System variables
  readonly section = input.required<OverviewSection<OverviewStock>>();
  readonly query = input.required<OverviewStockQueryInput>();
  readonly canOpenProduct = input.required<boolean>();
  readonly reloadRequested = output<void>();
  readonly thresholdApplied = output<number>();
  readonly pageChanged = output<number>();
  readonly pageSizeChanged = output<number>();

  private readonly committedThreshold = computed(() => this.query().threshold);

  // Business variables
  readonly pageSizes = OVERVIEW_PAGE_SIZE_OPTIONS;
  readonly thresholdDraft = signal<number | null>(5);

  readonly stockItems = computed(() => [...(this.section().data?.items ?? [])]);
  readonly stockPageCount = computed(() =>
    Math.max(1, Math.ceil((this.section().data?.total ?? 0) / this.query().pageSize)),
  );
  readonly stockRangeStart = computed(() =>
    this.section().data?.items.length ? (this.query().page - 1) * this.query().pageSize + 1 : 0,
  );
  readonly stockRangeEnd = computed(() =>
    this.stockRangeStart()
      ? this.stockRangeStart() + (this.section().data?.items.length ?? 0) - 1
      : 0,
  );
  readonly thresholdError = computed(() => {
    const value = this.thresholdDraft();
    return value === null || !Number.isInteger(value) || value < 0 || value > OVERVIEW_MAX_THRESHOLD
      ? `Nhập số nguyên từ 0 đến ${OVERVIEW_MAX_THRESHOLD}.`
      : '';
  });

  constructor() {
    effect(() => {
      const threshold = this.committedThreshold();
      untracked(() => this.thresholdDraft.set(threshold));
    });
  }

  ngOnInit(): void {
    this.thresholdDraft.set(this.query().threshold);
  }

  requestReload(): void {
    this.reloadRequested.emit();
  }

  setThreshold(value: number | string | null): void {
    this.thresholdDraft.set(value === null || value === '' ? null : Number(value));
  }

  applyThreshold(): void {
    const threshold = this.thresholdDraft();
    if (threshold === null || this.thresholdError()) return;
    this.thresholdApplied.emit(threshold);
  }

  setPage(page: number): void {
    if (page < 1 || page > this.stockPageCount()) return;
    this.pageChanged.emit(page);
  }

  setPageSize(pageSize: number): void {
    if (!OVERVIEW_PAGE_SIZES.some((value) => value === pageSize)) return;
    this.pageSizeChanged.emit(pageSize);
  }

  stockKind(kind: OverviewFulfillmentKind): string {
    return getOverviewStockKindLabel(kind);
  }
}
