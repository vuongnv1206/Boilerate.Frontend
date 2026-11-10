import { Component, computed } from '@angular/core';
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
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
} from '@api/ordering/models/order.dto';
import { OrdersWorkspace } from '../orders-workspace.component';

@Component({
  selector: 'app-orders',
  host: { class: 'collection-screen' },
  imports: [SHARED_IMPORTS],
  templateUrl: './orders.component.html',
})
export class Orders extends BaseComponent {
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

  constructor(readonly workspace: OrdersWorkspace) {
    super();
  }

  routeQuery(): Record<string, string | number> {
    return this.workspace.routeQuery();
  }

  setQuery(q: string): void {
    this.workspace.search(q);
  }

  setStatus(status: OrderStatus | null): void {
    this.workspace.patchQuery({ status }, { resetPage: true });
  }

  setPaymentStatus(paymentStatus: OrderPaymentStatus | null): void {
    this.workspace.patchQuery({ paymentStatus }, { resetPage: true });
  }

  setFulfillmentStatus(fulfillmentStatus: OrderFulfillmentStatus | null): void {
    this.workspace.patchQuery({ fulfillmentStatus }, { resetPage: true });
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
    this.workspace.patchQuery({ [key]: value }, { resetPage: true });
  }

  setDatePicker(key: 'createdFrom' | 'createdTo', value: Date | null): void {
    const formatted = value
      ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
      : '';
    this.setDate(key, formatted);
  }

  setPage(page: number): void {
    this.workspace.setPage(page);
  }

  changePageSize(value: number | string): void {
    const pageSize = Number(value);
    if (this.pageSizes.some((size) => size === pageSize)) {
      this.workspace.patchQuery({ pageSize }, { resetPage: true });
    }
  }

  resetFilters(): void {
    this.workspace.patchQuery(
      {
        queue: null,
        q: '',
        status: null,
        paymentStatus: null,
        fulfillmentStatus: null,
        createdFrom: '',
        createdTo: '',
      },
      { resetPage: true },
    );
  }

  clearQueue(): void {
    this.workspace.patchQuery({ queue: null }, { resetPage: true });
  }

  private parseDate(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
