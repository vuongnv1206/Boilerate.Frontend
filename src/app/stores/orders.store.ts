import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, of, switchMap } from 'rxjs';
import { ApiError } from '@core/http/api-error';
import { OrdersService } from '@services/orders.service';
import { OrderListQuery, OrderPage } from '@models/order.dto';

@Injectable()
export class OrdersStore {
  private readonly service = inject(OrdersService);
  private readonly requests = new Subject<OrderListQuery>();
  private readonly pageState = signal<OrderPage>({
    items: [],
    total: 0,
    pageNumber: 1,
    pageSize: 10,
  });
  private readonly queryState = signal<OrderListQuery>({
    q: '',
    status: null,
    paymentStatus: null,
    fulfillmentStatus: null,
    createdFrom: '',
    createdTo: '',
    page: 1,
    pageSize: 10,
  });
  private readonly loadingState = signal(false);
  private readonly errorState = signal('');
  private readonly correctionState = signal<number | null>(null);
  readonly page = this.pageState.asReadonly();
  readonly query = this.queryState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly queryCorrection = this.correctionState.asReadonly();
  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.page().total / this.page().pageSize)),
  );
  readonly rangeStart = computed(() =>
    this.page().items.length ? (this.page().pageNumber - 1) * this.page().pageSize + 1 : 0,
  );
  readonly rangeEnd = computed(() =>
    this.rangeStart() ? this.rangeStart() + this.page().items.length - 1 : 0,
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.requests
      .pipe(
        switchMap((query) => {
          this.loadingState.set(true);
          this.errorState.set('');
          return this.service.list(query).pipe(
            catchError((error: unknown) => {
              this.errorState.set(
                error instanceof ApiError
                  ? error.message
                  : 'Không thể tải đơn hàng. Vui lòng thử lại.',
              );
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((page) => {
        this.loadingState.set(false);
        if (!page) return;
        const lastPage = Math.max(1, Math.ceil(page.total / page.pageSize));
        if (this.query().page > lastPage) {
          this.correctionState.set(lastPage);
          return;
        }
        this.correctionState.set(null);
        this.pageState.set(page);
      });
    destroyRef.onDestroy(() => this.requests.complete());
  }

  applyQuery(query: OrderListQuery): void {
    this.queryState.set(query);
    this.correctionState.set(null);
    this.requests.next(query);
  }

  load(): void {
    this.requests.next(this.query());
  }
}
