import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { ApiService } from '@core/http/api.service';
import {
  AdminCustomerPage,
  CheckoutRequest,
  GuestPaymentSettings,
  OrderDto,
  OrderHistoryEntry,
  OrderListQuery,
  OrderPage,
} from '../models/order.dto';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  constructor(
    private readonly api: ApiService,
    private readonly session: AuthSession,
  ) {}

  list(query: OrderListQuery): Observable<OrderPage> {
    return this.api.get<OrderPage>('admin/orders', this.buildListParams(query));
  }

  exportOrders(query: OrderListQuery): Observable<void> {
    const { page: _p, size: _s, ...filters } = this.buildListParams(query);
    void _p;
    void _s;
    return this.api.download('GET', 'admin/orders/export', filters, 'orders.xlsx');
  }

  downloadPackingSlip(id: string, orderNumber: string): Observable<void> {
    return this.api.download(
      'GET',
      `admin/orders/${encodeURIComponent(id)}/packing-slip`,
      undefined,
      `packing-slip-${orderNumber}.pdf`,
    );
  }

  getCustomers(search: string, page = 1, size = 20): Observable<AdminCustomerPage> {
    return this.api.get<AdminCustomerPage>('admin/orders/customers', {
      page,
      size,
      ...(search.trim() ? { search: search.trim() } : {}),
    });
  }

  private buildListParams(query: OrderListQuery) {
    return {
      page: query.page,
      size: query.pageSize,
      ...(query.queue ? { queue: query.queue } : {}),
      ...(query.q ? { search: query.q } : {}),
      ...(query.status === null ? {} : { status: query.status }),
      ...(query.paymentStatus === null ? {} : { paymentStatus: query.paymentStatus }),
      ...(query.fulfillmentStatus === null ? {} : { fulfillmentStatus: query.fulfillmentStatus }),
      ...(query.createdFrom ? { createdFrom: query.createdFrom } : {}),
      ...(query.createdTo ? { createdTo: `${query.createdTo}T23:59:59.999Z` } : {}),
    };
  }

  getById(id: string): Observable<OrderDto> {
    return this.api.get<OrderDto>(`admin/orders/${encodeURIComponent(id)}`);
  }

  getHistory(id: string): Observable<readonly OrderHistoryEntry[]> {
    return this.api.get<readonly OrderHistoryEntry[]>(
      `admin/orders/${encodeURIComponent(id)}/history`,
    );
  }

  cancelAdminOrder(id: string, version: string, _operationId?: string): Observable<OrderDto> {
    void _operationId;
    return this.api.post<OrderDto>(`admin/orders/${encodeURIComponent(id)}/cancel`, { version });
  }

  getMyOrders(page = 1, size = 20): Observable<OrderPage> {
    const path = this.session.signedIn() ? 'orders/mine' : 'storefront/orders';
    return this.api.get<OrderPage>(path, { page, size }, { withCredentials: true });
  }

  getCustomerOrder(id: string): Observable<OrderDto> {
    const prefix = this.session.signedIn() ? 'orders' : 'storefront/orders';
    return this.api.get<OrderDto>(`${prefix}/${encodeURIComponent(id)}`, undefined, {
      withCredentials: true,
    });
  }

  cancelCustomerOrder(id: string, version: string): Observable<OrderDto> {
    const prefix = this.session.signedIn() ? 'orders' : 'storefront/orders';
    return this.api.post<OrderDto>(
      `${prefix}/${encodeURIComponent(id)}/cancel`,
      { version },
      { withCredentials: true },
    );
  }

  checkout(request: CheckoutRequest): Observable<OrderDto> {
    const path = this.session.signedIn() ? 'orders/checkout' : 'storefront/checkout';
    return this.api.post<OrderDto>(path, request, { withCredentials: true });
  }

  getPaymentSettings(): Observable<GuestPaymentSettings> {
    return this.api.get<GuestPaymentSettings>('storefront/settings', undefined, {
      withCredentials: true,
    });
  }
}
