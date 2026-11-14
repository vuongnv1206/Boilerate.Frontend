import { Component } from '@angular/core';
import { Params } from '@angular/router';
import { Observable } from 'rxjs';
import { BaseRouteListComponent } from '@core/base/base-route-list.component';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  ORDER_STATUS_LABELS,
  OrderDto,
  OrderListQuery,
  OrderPage,
  OrderSummary,
} from '@api/ordering/models/order.dto';
import {
  orderListQueryParams,
  orderStatusTone,
  readOrderListQuery,
} from '@api/ordering/models/order.util';
import { OrdersService } from '@api/ordering/services/orders.service';

@Component({
  selector: 'app-orders-workspace',
  host: { class: 'orders-workspace-shell' },
  imports: [SHARED_IMPORTS],
  templateUrl: './orders-workspace.component.html',
})
export class OrdersWorkspace extends BaseRouteListComponent<OrderSummary, OrderListQuery> {
  // System variables
  private readonly observedVersions = new Map<string, string>();

  // Business variables
  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly statusTone = orderStatusTone;

  constructor(private readonly ordersService: OrdersService) {
    super();
  }

  protected override parseQuery(params: Params): OrderListQuery {
    return readOrderListQuery(params);
  }

  protected override serializeQuery(query: OrderListQuery): Record<string, string | number> {
    return orderListQueryParams(query);
  }

  protected override fetchPage(query: OrderListQuery): Observable<OrderPage> {
    return this.ordersService.list(query);
  }

  protected override fetchErrorMessage(rawError: unknown): string {
    const apiError = normalizeApiError(rawError);
    return apiError.status > 0 ? apiError.message : 'Không thể tải đơn hàng. Vui lòng thử lại.';
  }

  updateVisibleOrder(order: OrderDto): void {
    if (this.observedVersions.get(order.id) === order.version) return;
    this.observedVersions.set(order.id, order.version);
    this.load();
  }
}
