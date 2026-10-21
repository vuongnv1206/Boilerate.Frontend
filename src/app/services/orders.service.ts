import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/http/api-client';
import {
  ConfirmPaymentRequest,
  AfterSalesSummary,
  OrderDto,
  OrderHistoryEntry,
  OrderListQuery,
  OrderPage,
  ShipmentSummary,
} from '@models/order.dto';

@Injectable()
export class OrdersService {
  private readonly api = inject(ApiClient);

  list(query: OrderListQuery): Observable<OrderPage> {
    return this.api.get<OrderPage>('admin/orders', {
      params: {
        page: query.page,
        size: query.pageSize,
        ...(query.q ? { search: query.q } : {}),
        ...(query.status === null ? {} : { status: query.status }),
        ...(query.paymentStatus === null ? {} : { paymentStatus: query.paymentStatus }),
        ...(query.fulfillmentStatus === null ? {} : { fulfillmentStatus: query.fulfillmentStatus }),
        ...(query.createdFrom ? { createdFrom: query.createdFrom } : {}),
        ...(query.createdTo ? { createdTo: `${query.createdTo}T23:59:59.999Z` } : {}),
      },
    });
  }

  get(id: string): Observable<OrderDto> {
    return this.api.get<OrderDto>(`admin/orders/${encodeURIComponent(id)}`);
  }

  history(id: string): Observable<readonly OrderHistoryEntry[]> {
    return this.api.get<readonly OrderHistoryEntry[]>(
      `admin/orders/${encodeURIComponent(id)}/history`,
    );
  }

  shipments(id: string): Observable<readonly ShipmentSummary[]> {
    return this.api.get<readonly ShipmentSummary[]>(
      `admin/orders/${encodeURIComponent(id)}/shipments`,
    );
  }

  afterSales(id: string): Observable<AfterSalesSummary> {
    return this.api.get<AfterSalesSummary>(`admin/orders/${encodeURIComponent(id)}/after-sales`);
  }

  cancel(id: string, version: string): Observable<OrderDto> {
    return this.api.post<OrderDto>(`admin/orders/${encodeURIComponent(id)}/cancel`, { version });
  }

  confirmPayment(id: string, request: ConfirmPaymentRequest): Observable<OrderDto> {
    return this.api.post<OrderDto>(
      `admin/orders/${encodeURIComponent(id)}/payment-confirmations`,
      request,
    );
  }

  retryFulfillment(id: string, version: string): Observable<OrderDto> {
    return this.api.post<OrderDto>(`admin/orders/${encodeURIComponent(id)}/retry-fulfillment`, {
      version,
    });
  }
}
