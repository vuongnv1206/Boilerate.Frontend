import {
  DestroyRef,
  Injectable,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, map, of, switchMap } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { normalizeApiError } from '@core/http/normalize-api-error';
import {
  AdminOverviewQuery,
  OverviewFinance,
  OverviewSection,
  OverviewStock,
  OverviewWork,
} from '@models/admin-overview.dto';
import { AdminOverviewService } from '@services/admin-overview.service';
import { defaultAdminOverviewQuery, overviewToday } from '@utils/admin-overview-query.util';

type FinanceQuery = Pick<AdminOverviewQuery, 'from' | 'to'>;
type StockQuery = Pick<AdminOverviewQuery, 'threshold' | 'page' | 'pageSize'>;

function emptySection<T>(): OverviewSection<T> {
  return { data: null, loading: false, error: '', forbidden: false };
}

@Injectable()
export class AdminOverviewStore {
  private readonly service = inject(AdminOverviewService);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  private readonly workRequests = new Subject<true | null>();
  private readonly financeRequests = new Subject<FinanceQuery | null>();
  private readonly stockRequests = new Subject<StockQuery | null>();
  private readonly workState = signal<OverviewSection<OverviewWork>>(emptySection());
  private readonly financeState = signal<OverviewSection<OverviewFinance>>(emptySection());
  private readonly stockState = signal<OverviewSection<OverviewStock>>(emptySection());
  private readonly queryState = signal(defaultAdminOverviewQuery(overviewToday(new Date())));
  private initialized = false;

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
  readonly workVisible = computed(() => this.canWork() && !this.work().forbidden);
  readonly financeVisible = computed(() => this.canFinance() && !this.finance().forbidden);
  readonly stockVisible = computed(() => this.canStock() && !this.stock().forbidden);
  readonly loading = computed(
    () => this.work().loading || this.finance().loading || this.stock().loading,
  );
  readonly stockPageCount = computed(() =>
    Math.max(1, Math.ceil((this.stock().data?.total ?? 0) / this.query().pageSize)),
  );
  readonly stockPageCorrection = computed(() => {
    const section = this.stock();
    const data = section.data;
    if (!data || section.loading || section.error) return null;
    const last = Math.max(1, Math.ceil(data.total / data.pageSize));
    return data.pageNumber > last ? last : null;
  });
  readonly stockRangeStart = computed(() =>
    this.stock().data?.items.length ? (this.query().page - 1) * this.query().pageSize + 1 : 0,
  );
  readonly stockRangeEnd = computed(() =>
    this.stockRangeStart()
      ? this.stockRangeStart() + (this.stock().data?.items.length ?? 0) - 1
      : 0,
  );

  constructor() {
    this.connect(this.workRequests, this.workState, () => this.service.work());
    this.connect(this.financeRequests, this.financeState, (query) => this.service.finance(query));
    this.connect(this.stockRequests, this.stockState, (query) => this.service.stock(query));
    let previous: { work: string; finance: boolean; stock: string } | null = null;
    effect(() => {
      const access = {
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
    this.destroyRef.onDestroy(() => {
      this.workRequests.complete();
      this.financeRequests.complete();
      this.stockRequests.complete();
    });
  }

  applyQuery(query: AdminOverviewQuery): void {
    const previous = this.query();
    this.queryState.set(query);
    if (!this.initialized) {
      this.initialized = true;
      this.refresh();
      return;
    }
    if (previous.from !== query.from || previous.to !== query.to) {
      this.financeState.set(emptySection());
      this.reloadFinance();
    }
    if (
      previous.threshold !== query.threshold ||
      previous.page !== query.page ||
      previous.pageSize !== query.pageSize
    ) {
      this.stockState.set(emptySection());
      this.reloadStock();
    }
  }

  refresh(): void {
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

  private connect<T, Q>(
    requests: Subject<Q | null>,
    state: WritableSignal<OverviewSection<T>>,
    load: (query: Q) => Observable<T>,
  ): void {
    requests
      .pipe(
        switchMap((query) => {
          if (query === null) {
            state.set(emptySection());
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
