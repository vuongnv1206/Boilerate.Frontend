import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { Subject, debounceTime, filter } from 'rxjs';
import { ORDER_STATUS_LABELS } from '@constants/order.constants';
import { Icon } from '@shared/ui/icon/icon.component';
import { StatusBadge } from '@shared/ui/status-badge/status-badge.component';
import { OrdersStore } from '@stores/orders.store';
import {
  orderListQueryParams,
  readOrderListQuery,
  sameOrderQueryParams,
} from '@utils/order-query.util';
import { OrderListQuery, OrderStatus } from '@models/order.dto';

@Component({
  selector: 'app-orders-workspace',
  host: { class: 'orders-workspace-shell' },
  imports: [RouterOutlet, RouterLink, Icon, StatusBadge, CurrencyPipe, DatePipe, CdkTrapFocus],
  providers: [OrdersStore],
  templateUrl: './orders-workspace.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersWorkspace implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly typing = new Subject<string>();
  readonly store = inject(OrdersStore);
  readonly editorId = signal<string | null>(null);
  readonly panelOpen = signal(false);
  readonly statusLabels = ORDER_STATUS_LABELS;

  constructor() {
    effect(() => {
      const page = this.store.queryCorrection();
      if (page !== null)
        this.updateQuery({ ...readOrderListQuery(this.route.snapshot.queryParams), page }, true);
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
      const query = readOrderListQuery(params);
      const canonical = orderListQueryParams(query);
      if (!sameOrderQueryParams(params, canonical)) {
        this.updateQuery(query, true);
        return;
      }
      this.store.applyQuery(query);
    });
    this.typing
      .pipe(debounceTime(260), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.updateQuery({ ...this.query(), q, page: 1 }, true));
  }

  routeQuery(): Record<string, string | number> {
    return orderListQueryParams(this.query());
  }

  search(q: string): void {
    this.typing.next(q);
  }

  setPage(page: number): void {
    this.updateQuery({ ...this.query(), page });
  }

  private query(): OrderListQuery {
    return readOrderListQuery(this.route.snapshot.queryParams);
  }

  private updateQuery(query: OrderListQuery, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: orderListQueryParams(query),
      replaceUrl,
    });
  }

  private readEditorRoute(): void {
    const child = this.route.snapshot.firstChild;
    this.editorId.set(child?.paramMap.get('id') ?? null);
  }

  statusTone(status: OrderStatus): 'success' | 'warning' | 'neutral' | 'muted' {
    if (status === OrderStatus.Completed) return 'success';
    if (status === OrderStatus.PendingPayment) return 'warning';
    if (status === OrderStatus.Cancelled || status === OrderStatus.Expired) return 'muted';
    return 'neutral';
  }
}
