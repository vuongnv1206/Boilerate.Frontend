import { Component, OnInit, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { BaseComponent } from '@core/base';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  ORDER_FULFILLMENT_STATUS_LABELS,
  ORDER_FULFILLMENT_STATUS_OPTIONS,
  ORDER_PAGE_SIZES,
  ORDER_PAYMENT_METHOD_LABELS,
  ORDER_PAYMENT_STATUS_LABELS,
  ORDER_PAYMENT_STATUS_OPTIONS,
  ORDER_QUEUE_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_OPTIONS,
  OrderFulfillmentStatus,
  OrderListQuery,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
  orderListQueryParams,
  readOrderListQuery,
} from '@api/ordering/models/order.dto';
import { OrdersWorkspace } from '../orders-workspace.component';

@Component({
  selector: 'app-orders',
  host: { class: 'collection-screen' },
  imports: [SHARED_IMPORTS],
  templateUrl: './orders.component.html',
})
export class Orders extends BaseComponent implements OnInit {
  // System variables
  private readonly typing = new Subject<string>();

  // Business variables
  readonly queueLabels = ORDER_QUEUE_LABELS;
  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly paymentStatusLabels = ORDER_PAYMENT_STATUS_LABELS;
  readonly fulfillmentStatusLabels = ORDER_FULFILLMENT_STATUS_LABELS;
  readonly paymentMethodLabels = ORDER_PAYMENT_METHOD_LABELS;
  readonly statusOptions = ORDER_STATUS_OPTIONS;
  readonly paymentStatusOptions = ORDER_PAYMENT_STATUS_OPTIONS;
  readonly fulfillmentStatusOptions = ORDER_FULFILLMENT_STATUS_OPTIONS;
  readonly pageSizes = Array.from(ORDER_PAGE_SIZES);
  readonly status = OrderStatus;
  readonly paymentStatus = OrderPaymentStatus;
  readonly fulfillmentStatus = OrderFulfillmentStatus;
  readonly createdFromDate = computed(() => this.parseDate(this.workspace.query().createdFrom));
  readonly createdToDate = computed(() => this.parseDate(this.workspace.query().createdTo));

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    readonly workspace: OrdersWorkspace,
  ) {
    super();
    this.destroyRef.onDestroy(() => this.typing.complete());
  }

  ngOnInit(): void {
    this.typing.pipe(debounceTime(260), takeUntilDestroyed(this.destroyRef)).subscribe((q) => {
      this.update({ ...this.currentQuery(), q, page: 1 });
    });
  }

  routeQuery(): Record<string, string | number> {
    return orderListQueryParams(this.currentQuery());
  }

  setQuery(q: string): void {
    this.typing.next(q);
  }

  setStatus(status: OrderStatus | null): void {
    this.update({ ...this.currentQuery(), status, page: 1 });
  }

  setPaymentStatus(paymentStatus: OrderPaymentStatus | null): void {
    this.update({ ...this.currentQuery(), paymentStatus, page: 1 });
  }

  setFulfillmentStatus(fulfillmentStatus: OrderFulfillmentStatus | null): void {
    this.update({ ...this.currentQuery(), fulfillmentStatus, page: 1 });
  }

  statusLabel(value: OrderStatus): string {
    return this.statusLabels[value];
  }

  paymentStatusLabel(value: OrderPaymentStatus): string {
    return this.paymentStatusLabels[value];
  }

  fulfillmentStatusLabel(value: OrderFulfillmentStatus): string {
    return this.fulfillmentStatusLabels[value];
  }

  paymentMethodLabel(value: OrderPaymentMethod): string {
    return this.paymentMethodLabels[value];
  }

  setDate(key: 'createdFrom' | 'createdTo', value: string): void {
    this.update({ ...this.currentQuery(), [key]: value, page: 1 });
  }

  setDatePicker(key: 'createdFrom' | 'createdTo', value: Date | null): void {
    const formatted = value
      ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
      : '';
    this.setDate(key, formatted);
  }

  setPage(page: number): void {
    this.update({ ...this.currentQuery(), page });
  }

  changePageSize(value: number | string): void {
    const pageSize = Number(value);
    if (this.pageSizes.some((size) => size === pageSize)) {
      this.update({ ...this.currentQuery(), pageSize, page: 1 });
    }
  }

  resetFilters(): void {
    this.update({
      ...this.currentQuery(),
      queue: null,
      q: '',
      status: null,
      paymentStatus: null,
      fulfillmentStatus: null,
      createdFrom: '',
      createdTo: '',
      page: 1,
    });
  }

  clearQueue(): void {
    this.update({ ...this.currentQuery(), queue: null, page: 1 });
  }

  private parseDate(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private currentQuery(): OrderListQuery {
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
