import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { BaseApiService } from '@core/base';
import {
  CheckoutRequest,
  GuestPaymentSettings,
  OrderDto,
  OrderHistoryEntry,
  OrderListQuery,
  OrderPage,
} from '../models/order.dto';

@Injectable({ providedIn: 'root' })
export class OrdersService extends BaseApiService {
  constructor(private readonly session: AuthSession) {
    super();
  }

  list(query: OrderListQuery): Observable<OrderPage> {
    return this.get<OrderPage>('admin/orders', {
      page: query.page,
      size: query.pageSize,
      ...(query.queue ? { queue: query.queue } : {}),
      ...(query.q ? { search: query.q } : {}),
      ...(query.status === null ? {} : { status: query.status }),
      ...(query.paymentStatus === null ? {} : { paymentStatus: query.paymentStatus }),
      ...(query.fulfillmentStatus === null ? {} : { fulfillmentStatus: query.fulfillmentStatus }),
      ...(query.createdFrom ? { createdFrom: query.createdFrom } : {}),
      ...(query.createdTo ? { createdTo: `${query.createdTo}T23:59:59.999Z` } : {}),
    });
  }

  getById(id: string): Observable<OrderDto> {
    return this.get<OrderDto>(`admin/orders/${encodeURIComponent(id)}`);
  }

  getHistory(id: string): Observable<readonly OrderHistoryEntry[]> {
    return this.get<readonly OrderHistoryEntry[]>(`admin/orders/${encodeURIComponent(id)}/history`);
  }

  cancelAdminOrder(id: string, version: string, _operationId?: string): Observable<OrderDto> {
    void _operationId;
    return this.post<OrderDto>(`admin/orders/${encodeURIComponent(id)}/cancel`, { version });
  }

  getMyOrders(page = 1, size = 20): Observable<OrderPage> {
    const path = this.session.signedIn() ? 'orders/mine' : 'storefront/orders';
    return this.get<OrderPage>(path, { page, size }, { withCredentials: true });
  }

  getCustomerOrder(id: string): Observable<OrderDto> {
    const prefix = this.session.signedIn() ? 'orders' : 'storefront/orders';
    return this.get<OrderDto>(`${prefix}/${encodeURIComponent(id)}`, undefined, {
      withCredentials: true,
    });
  }

  cancelCustomerOrder(id: string, version: string): Observable<OrderDto> {
    const prefix = this.session.signedIn() ? 'orders' : 'storefront/orders';
    return this.post<OrderDto>(
      `${prefix}/${encodeURIComponent(id)}/cancel`,
      { version },
      { withCredentials: true },
    );
  }

  checkout(request: CheckoutRequest): Observable<OrderDto> {
    const path = this.session.signedIn() ? 'orders/checkout' : 'storefront/checkout';
    return this.post<OrderDto>(path, request, { withCredentials: true });
  }

  getPaymentSettings(): Observable<GuestPaymentSettings> {
    return this.get<GuestPaymentSettings>('storefront/settings', undefined, {
      withCredentials: true,
    });
  }
}
