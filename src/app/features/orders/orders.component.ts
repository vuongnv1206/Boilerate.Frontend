import { ButtonDirective } from 'primeng/button';
import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { Table } from 'primeng/table';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { StatusBadge } from '@shared/ui/status-badge/status-badge.component';
import { OrdersStore } from '@stores/orders.store';
import {
  OrderListQuery,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
  OrderFulfillmentStatus,
} from '@models/order.dto';
import {
  ORDER_FULFILLMENT_STATUS_LABELS,
  ORDER_FULFILLMENT_STATUS_OPTIONS,
  ORDER_PAGE_SIZES,
  ORDER_QUEUE_LABELS,
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
    DatePicker,
    Table,
    ButtonDirective,
  ],
  templateUrl: './orders.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Orders implements OnInit {
  readonly queueLabels = ORDER_QUEUE_LABELS;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(OrdersStore);
  readonly createdFromDate = computed(() => this.dateValue(this.store.query().createdFrom));
  readonly createdToDate = computed(() => this.dateValue(this.store.query().createdTo));
  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly paymentStatusLabels = ORDER_PAYMENT_STATUS_LABELS;
  readonly fulfillmentStatusLabels = ORDER_FULFILLMENT_STATUS_LABELS;
  readonly paymentMethodLabels = ORDER_PAYMENT_METHOD_LABELS;
  readonly statusOptions = ORDER_STATUS_OPTIONS;
  readonly paymentStatusOptions = ORDER_PAYMENT_STATUS_OPTIONS;
  readonly fulfillmentStatusOptions = ORDER_FULFILLMENT_STATUS_OPTIONS;
  readonly pageSizes: number[] = [...ORDER_PAGE_SIZES];
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
    this.update({ ...this.query(), [key]: value, page: 1 });
  }
  private dateValue(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  setDatePicker(key: 'createdFrom' | 'createdTo', value: Date | null): void {
    const formatted = value
      ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
      : '';
    this.setDate(key, formatted);
  }
  setPage(page: number): void {
    this.update({ ...this.query(), page });
  }
  changePageSize(value: number | string): void {
    const pageSize = Number(value);
    if (this.pageSizes.some((size) => size === pageSize))
      this.update({ ...this.query(), pageSize, page: 1 });
  }
  resetFilters(): void {
    this.update({
      ...this.query(),
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
    this.update({ ...this.query(), queue: null, page: 1 });
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
