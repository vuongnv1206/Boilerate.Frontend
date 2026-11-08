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
  OVERVIEW_RANGE_OPTIONS,
  OverviewDateRangeInput,
  OverviewFinance,
  OverviewRangePreset,
  OverviewSection,
  formatOverviewMoney,
  overviewAddDays,
  overviewChart,
  overviewDateString,
  overviewDateValue,
  overviewRangeError,
  overviewRangePreset,
} from '../../models/overview.dto';

@Component({
  selector: 'app-overview-finance-panel',
  host: { style: 'display: contents' },
  imports: [SHARED_IMPORTS],
  templateUrl: './overview-finance-panel.component.html',
})
export class OverviewFinancePanelComponent implements OnInit {
  // System variables
  readonly section = input.required<OverviewSection<OverviewFinance>>();
  readonly query = input.required<OverviewDateRangeInput>();
  readonly today = input.required<string>();
  readonly reloadRequested = output<void>();
  readonly dateRangeApplied = output<OverviewDateRangeInput>();

  private readonly committedRange = computed(
    () => `${this.query().from}:${this.query().to}:${this.today()}`,
  );

  // Business variables
  readonly rangeOptions = OVERVIEW_RANGE_OPTIONS;
  readonly preset = signal<OverviewRangePreset>('7');
  readonly fromDraft = signal<Date | null>(null);
  readonly toDraft = signal<Date | null>(null);
  readonly showDailyData = signal(false);

  readonly maxDate = computed(() => overviewDateValue(this.today()) ?? new Date());
  readonly financeDays = computed(() => [...(this.section().data?.days ?? [])]);
  readonly chart = computed(() => overviewChart(this.financeDays()));
  readonly rangeError = computed(() =>
    overviewRangeError(
      overviewDateString(this.fromDraft()),
      overviewDateString(this.toDraft()),
      this.today(),
    ),
  );

  constructor() {
    effect(() => {
      this.committedRange();
      untracked(() => this.syncDrafts());
    });
  }

  ngOnInit(): void {
    this.syncDrafts();
  }

  requestReload(): void {
    this.reloadRequested.emit();
  }

  setPreset(value: OverviewRangePreset): void {
    this.preset.set(value);
    if (value === 'custom') return;
    const days = value === 'today' ? 1 : Number(value);
    const to = this.today();
    const from = overviewAddDays(to, -(days - 1));
    this.fromDraft.set(overviewDateValue(from));
    this.toDraft.set(overviewDateValue(to));
    this.dateRangeApplied.emit({ from, to });
  }

  setFromDate(value: Date | null): void {
    this.fromDraft.set(value);
  }

  setToDate(value: Date | null): void {
    this.toDraft.set(value);
  }

  applyDates(): void {
    if (this.rangeError()) return;
    this.dateRangeApplied.emit({
      from: overviewDateString(this.fromDraft()),
      to: overviewDateString(this.toDraft()),
    });
  }

  toggleDailyData(): void {
    this.showDailyData.set(!this.showDailyData());
  }

  money(value: string): string {
    return formatOverviewMoney(value);
  }

  private syncDrafts(): void {
    const current = this.query();
    this.preset.set(overviewRangePreset(current, this.today()));
    this.fromDraft.set(overviewDateValue(current.from));
    this.toDraft.set(overviewDateValue(current.to));
  }
}
