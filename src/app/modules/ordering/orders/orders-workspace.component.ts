import { Component, ElementRef, OnInit, computed, effect, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subject, catchError, debounceTime, filter, of, switchMap } from 'rxjs';
import { BaseComponent } from '@core/base';
import { ApiError } from '@core/http/api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  DEFAULT_ORDER_LIST_QUERY,
  EMPTY_ADMIN_ORDER_PAGE,
  ORDER_STATUS_LABELS,
  OrderDto,
  OrderListQuery,
  OrderPage,
  orderListQueryParams,
  orderStatusTone,
  readOrderListQuery,
  sameOrderQueryParams,
} from '@api/ordering/models/order.dto';
import { OrdersService } from '@api/ordering/services/orders.service';

@Component({
  selector: 'app-orders-workspace',
  host: { class: 'orders-workspace-shell' },
  imports: [SHARED_IMPORTS],
  templateUrl: './orders-workspace.component.html',
})
export class OrdersWorkspace extends BaseComponent implements OnInit {
  // System variables
  private readonly requests = new Subject<OrderListQuery>();
  private readonly typing = new Subject<string>();
  private readonly observedVersions = new Map<string, string>();
  private readonly itemsToggle = viewChild<ElementRef<HTMLButtonElement>>('itemsToggle');

  // Business variables
  readonly page = signal<OrderPage>(EMPTY_ADMIN_ORDER_PAGE);
  readonly query = signal<OrderListQuery>(DEFAULT_ORDER_LIST_QUERY);
  readonly queryCorrection = signal<number | null>(null);
  readonly editorId = signal<string | null>(null);
  readonly panelOpen = signal(false);
  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly statusTone = orderStatusTone;

  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.page().total / this.page().pageSize)),
  );
  readonly rangeStart = computed(() =>
    this.page().items.length ? (this.page().pageNumber - 1) * this.page().pageSize + 1 : 0,
  );
  readonly rangeEnd = computed(() =>
    this.rangeStart() ? this.rangeStart() + this.page().items.length - 1 : 0,
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly ordersService: OrdersService,
  ) {
    super();
    this.requests
      .pipe(
        switchMap((nextQuery) => {
          this.loading.set(true);
          this.errorMessage.set('');
          return this.ordersService.list(nextQuery).pipe(
            catchError((error: unknown) => {
              this.errorMessage.set(
                error instanceof ApiError
                  ? error.message
                  : 'Không thể tải đơn hàng. Vui lòng thử lại.',
              );
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (!result) return;
        const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
        if (this.query().page > lastPage) {
          this.queryCorrection.set(lastPage);
          return;
        }
        this.queryCorrection.set(null);
        this.page.set(result);
      });

    this.destroyRef.onDestroy(() => {
      this.requests.complete();
      this.typing.complete();
    });

    effect(() => {
      const correctedPage = this.queryCorrection();
      if (correctedPage !== null) {
        this.updateQuery(
          { ...readOrderListQuery(this.route.snapshot.queryParams), page: correctedPage },
          true,
        );
      }
    });
  }

  ngOnInit(): void {
    this.readEditorRoute();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.readEditorRoute();
        this.panelOpen.set(false);
      });
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const parsed = readOrderListQuery(params);
      const canonical = orderListQueryParams(parsed);
      if (!sameOrderQueryParams(params, canonical)) {
        this.updateQuery(parsed, true);
        return;
      }
      this.applyQuery(parsed);
    });
    this.typing
      .pipe(debounceTime(260), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.updateQuery({ ...this.currentRouteQuery(), q, page: 1 }, true));
  }

  applyQuery(nextQuery: OrderListQuery): void {
    this.query.set(nextQuery);
    this.queryCorrection.set(null);
    this.requests.next(nextQuery);
  }

  load(): void {
    this.requests.next(this.query());
  }

  updateVisibleOrder(order: OrderDto): void {
    if (this.observedVersions.get(order.id) === order.version) return;
    this.observedVersions.set(order.id, order.version);
    this.load();
  }

  routeQuery(): Record<string, string | number> {
    return orderListQueryParams(this.currentRouteQuery());
  }

  search(q: string): void {
    this.typing.next(q);
  }

  setPage(nextPage: number): void {
    this.updateQuery({ ...this.currentRouteQuery(), page: nextPage });
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.itemsToggle()?.nativeElement.focus();
  }

  private currentRouteQuery(): OrderListQuery {
    return readOrderListQuery(this.route.snapshot.queryParams);
  }

  private updateQuery(nextQuery: OrderListQuery, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: orderListQueryParams(nextQuery),
      replaceUrl,
    });
  }

  private readEditorRoute(): void {
    const child = this.route.snapshot.firstChild;
    this.editorId.set(child?.paramMap.get('id') ?? null);
  }
}
