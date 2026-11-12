import {
  Component,
  OnInit,
  WritableSignal,
  computed,
  effect,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Observable, Subject, catchError, map, of, switchMap } from 'rxjs';
import { BaseComponent } from '@core/base/base.component';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  AdminOverviewDto,
  AdminOverviewQuery,
  OverviewAccessSnapshot,
  OverviewDateRangeInput,
  OverviewFinance,
  OverviewSection,
  OverviewStock,
  OverviewStockQueryInput,
  OverviewWork,
  adminOverviewQueryParams,
  defaultAdminOverviewQuery,
  emptyOverviewSection,
  overviewToday,
  readAdminOverviewQuery,
  sameOverviewParams,
} from '@api/overview/models/overview.dto';
import { AdminOverviewService } from '@api/overview/services/admin-overview.service';
import { OverviewFinancePanelComponent } from './overview-finance-panel/overview-finance-panel.component';
import { OverviewStockPanelComponent } from './overview-stock-panel/overview-stock-panel.component';
import { OverviewWorkPanelComponent } from './overview-work-panel/overview-work-panel.component';

@Component({
  selector: 'app-overview',
  host: { class: 'collection-screen' },
  imports: [
    SHARED_IMPORTS,
    OverviewWorkPanelComponent,
    OverviewFinancePanelComponent,
    OverviewStockPanelComponent,
  ],
  templateUrl: './overview.component.html',
})
export class OverviewComponent extends BaseComponent implements OnInit {
  // System variables
  private readonly workRequests = new Subject<true | null>();
  private readonly financeRequests = new Subject<OverviewDateRangeInput | null>();
  private readonly stockRequests = new Subject<OverviewStockQueryInput | null>();
  private readonly todayState = signal(overviewToday(new Date()));
  private readonly workState = signal<OverviewSection<OverviewWork>>(emptyOverviewSection());
  private readonly financeState = signal<OverviewSection<OverviewFinance>>(emptyOverviewSection());
  private readonly stockState = signal<OverviewSection<OverviewStock>>(emptyOverviewSection());
  private readonly queryState = signal<AdminOverviewQuery>(
    defaultAdminOverviewQuery(this.todayState()),
  );
  private initialized = false;

  // Business variables
  readonly today = this.todayState.asReadonly();
  readonly work = this.workState.asReadonly();
  readonly finance = this.financeState.asReadonly();
  readonly stock = this.stockState.asReadonly();
  readonly query = this.queryState.asReadonly();

  readonly canWork = computed(
    () => this.session.can('Order', 'View') || this.session.can('Renewal', 'View'),
  );
  readonly canFinance = computed(() => this.session.can('FinancialSummary', 'View'));
  readonly canStock = computed(
    () => this.session.can('Inventory', 'View') || this.session.can('DigitalInventory', 'View'),
  );
  readonly canOpenProduct = computed(() => this.session.can('Product', 'View'));

  readonly workVisible = computed(() => this.canWork() && !this.work().forbidden);
  readonly financeVisible = computed(() => this.canFinance() && !this.finance().forbidden);
  readonly stockVisible = computed(() => this.canStock() && !this.stock().forbidden);
  readonly hasVisibleSection = computed(
    () => this.workVisible() || this.financeVisible() || this.stockVisible(),
  );
  readonly refreshing = computed(
    () => this.work().loading || this.finance().loading || this.stock().loading,
  );
  readonly workGroups = computed(
    () =>
      this.work().data?.groups.filter((group) =>
        this.session.can(group.kind === 'order' ? 'Order' : 'Renewal', 'View'),
      ) ?? [],
  );
  readonly snapshot = computed<AdminOverviewDto>(() => ({
    work: this.work().data,
    finance: this.finance().data,
    stock: this.stock().data,
  }));

  private readonly stockPageCorrection = computed(() => {
    const section = this.stock();
    const data = section.data;
    if (!data || section.loading || section.error) return null;
    const last = Math.max(1, Math.ceil(data.total / data.pageSize));
    return data.pageNumber > last ? last : null;
  });

  constructor(
    private readonly overviewService: AdminOverviewService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    super();
    this.connectSection(this.workRequests, this.workState, () => this.overviewService.getWork());
    this.connectSection(this.financeRequests, this.financeState, (range) =>
      this.overviewService.getFinance(range),
    );
    this.connectSection(this.stockRequests, this.stockState, (stockQuery) =>
      this.overviewService.getStock(stockQuery),
    );

    let previous: OverviewAccessSnapshot | null = null;
    effect(() => {
      const access: OverviewAccessSnapshot = {
        work: `${this.session.can('Order', 'View')}:${this.session.can('Renewal', 'View')}`,
        finance: this.canFinance(),
        stock: `${this.session.can('Inventory', 'View')}:${this.session.can('DigitalInventory', 'View')}`,
      };
      untracked(() => {
        if (previous && previous.work !== access.work) {
          this.workRequests.next(null);
          if (this.initialized) this.reloadWork();
        }
        if (!access.finance) this.financeRequests.next(null);
        else if (previous && !previous.finance && this.initialized) this.reloadFinance();
        if (previous && previous.stock !== access.stock) {
          this.stockRequests.next(null);
          if (this.initialized) this.reloadStock();
        }
        previous = access;
      });
    });

    effect(() => {
      const page = this.stockPageCorrection();
      if (page !== null) {
        untracked(() => this.updateQuery({ ...this.query(), page }, true));
      }
    });

    this.destroyRef.onDestroy(() => {
      this.workRequests.complete();
      this.financeRequests.complete();
      this.stockRequests.complete();
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const values = Object.fromEntries(params.keys.map((key) => [key, params.get(key)]));
      const query = readAdminOverviewQuery(values, this.todayState());
      const canonical = adminOverviewQueryParams(query);
      if (!sameOverviewParams(values, canonical)) {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: canonical,
          replaceUrl: true,
        });
        return;
      }
      this.applyQuery(query);
    });
  }

  refresh(): void {
    this.todayState.set(overviewToday(new Date()));
    this.reloadWork();
    this.reloadFinance();
    this.reloadStock();
  }

  reloadWork(): void {
    if (this.canWork()) this.workRequests.next(true);
  }

  reloadFinance(): void {
    if (this.canFinance()) this.financeRequests.next(this.query());
  }

  reloadStock(): void {
    if (this.canStock()) this.stockRequests.next(this.query());
  }

  onDateRangeApplied(range: OverviewDateRangeInput): void {
    this.updateQuery({ ...this.query(), from: range.from, to: range.to });
  }

  onThresholdApplied(threshold: number): void {
    this.updateQuery({ ...this.query(), threshold, page: 1 });
  }

  onPageChanged(page: number): void {
    this.updateQuery({ ...this.query(), page });
  }

  onPageSizeChanged(pageSize: number): void {
    this.updateQuery({ ...this.query(), pageSize, page: 1 });
  }

  private applyQuery(query: AdminOverviewQuery): void {
    const previous = this.query();
    this.queryState.set(query);
    if (!this.initialized) {
      this.initialized = true;
      this.reloadWork();
      this.reloadFinance();
      this.reloadStock();
      return;
    }
    if (previous.from !== query.from || previous.to !== query.to) {
      this.financeState.set(emptyOverviewSection());
      this.reloadFinance();
    }
    if (
      previous.threshold !== query.threshold ||
      previous.page !== query.page ||
      previous.pageSize !== query.pageSize
    ) {
      this.stockState.set(emptyOverviewSection());
      this.reloadStock();
    }
  }

  private updateQuery(query: AdminOverviewQuery, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: adminOverviewQueryParams(query),
      replaceUrl,
    });
  }

  private connectSection<T, Q>(
    requests: Subject<Q | null>,
    state: WritableSignal<OverviewSection<T>>,
    load: (query: Q) => Observable<T>,
  ): void {
    requests
      .pipe(
        switchMap((query) => {
          if (query === null) {
            state.set(emptyOverviewSection());
            return EMPTY;
          }
          state.update((section) => ({ ...section, loading: true, error: '', forbidden: false }));
          return load(query).pipe(
            map((data): OverviewSection<T> => ({
              data,
              loading: false,
              error: '',
              forbidden: false,
            })),
            catchError((error: unknown) => {
              const failure = normalizeApiError(error);
              return of<OverviewSection<T>>({
                data: failure.status === 401 || failure.status === 403 ? null : state().data,
                loading: false,
                error: failure.message,
                forbidden: failure.status === 403,
              });
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((section) => state.set(section));
  }
}
