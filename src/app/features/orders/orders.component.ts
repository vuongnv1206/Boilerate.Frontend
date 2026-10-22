import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { StatusBadge } from '@shared/ui/status-badge/status-badge.component';
import { OrdersStore } from '@stores/orders.store';
import {
  OrderListQuery,
  OrderPaymentStatus,
  OrderStatus,
  OrderFulfillmentStatus,
} from '@models/order.dto';
import {
  ORDER_FULFILLMENT_STATUS_LABELS,
  ORDER_FULFILLMENT_STATUS_OPTIONS,
  ORDER_PAGE_SIZES,
  ORDER_PAYMENT_METHOD_LABELS,
  ORDER_PAYMENT_STATUS_LABELS,
  ORDER_PAYMENT_STATUS_OPTIONS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_OPTIONS,
} from '@constants/order.constants';
import { orderListQueryParams, readOrderListQuery } from '@utils/order-query.util';

@Component({
  selector: 'app-orders',
  host: { class: 'collection-screen' },
  imports: [
    RouterLink,
    ContentState,
    Icon,
    StatusBadge,
    CurrencyPipe,
    DatePipe,
    FormsModule,
    InputText,
    Select,
  ],
  templateUrl: './orders.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Orders implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(OrdersStore);
  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly paymentStatusLabels = ORDER_PAYMENT_STATUS_LABELS;
  readonly fulfillmentStatusLabels = ORDER_FULFILLMENT_STATUS_LABELS;
  readonly paymentMethodLabels = ORDER_PAYMENT_METHOD_LABELS;
  readonly statusOptions = ORDER_STATUS_OPTIONS;
  readonly paymentStatusOptions = ORDER_PAYMENT_STATUS_OPTIONS;
  readonly fulfillmentStatusOptions = ORDER_FULFILLMENT_STATUS_OPTIONS;
  readonly pageSizes = ORDER_PAGE_SIZES;
  readonly status = OrderStatus;
  readonly paymentStatus = OrderPaymentStatus;
  readonly fulfillmentStatus = OrderFulfillmentStatus;
  private readonly typing = new Subject<string>();

  ngOnInit(): void {
    this.typing.pipe(debounceTime(260), takeUntilDestroyed(this.destroyRef)).subscribe((q) => {
      this.update({ ...this.query(), q, page: 1 });
    });
  }

  routeQuery(): Record<string, string | number> {
    return orderListQueryParams(this.query());
  }
  setQuery(q: string): void {
    this.typing.next(q);
  }
  setStatus(status: OrderStatus | null): void {
    this.update({ ...this.query(), status, page: 1 });
  }
  setPaymentStatus(paymentStatus: OrderPaymentStatus | null): void {
    this.update({ ...this.query(), paymentStatus, page: 1 });
  }
  setFulfillmentStatus(fulfillmentStatus: OrderFulfillmentStatus | null): void {
    this.update({ ...this.query(), fulfillmentStatus, page: 1 });
  }
  setDate(key: 'createdFrom' | 'createdTo', value: string): void {
    this.update({ ...this.query(), [key]: value, page: 1 });
  }
  setPage(page: number): void {
    this.update({ ...this.query(), page });
  }
  changePageSize(event: Event): void {
    if (event.target instanceof HTMLSelectElement)
      this.update({ ...this.query(), pageSize: Number(event.target.value), page: 1 });
  }
  resetFilters(): void {
    this.update({
      ...this.query(),
      q: '',
      status: null,
      paymentStatus: null,
      fulfillmentStatus: null,
      createdFrom: '',
      createdTo: '',
      page: 1,
    });
  }
  private query(): OrderListQuery {
    return readOrderListQuery(this.route.snapshot.queryParams);
  }
  private update(query: OrderListQuery, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: orderListQueryParams(query),
      replaceUrl,
    });
  }
}
