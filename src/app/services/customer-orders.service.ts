import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/http/api-client';
import { CheckoutRequest } from '@models/checkout.dto';
import { DigitalDeliveryDto } from '@models/digital-delivery.dto';
import { OrderDto, OrderPage, ShipmentSummary } from '@models/order.dto';
import { AuthSession } from '@core/auth/auth-session';
import { GuestPaymentSettings, GuestVerificationResult } from '@models/storefront-settings.dto';

@Injectable({ providedIn: 'root' })
export class CustomerOrdersService {
  private readonly api = inject(ApiClient);
  private readonly session = inject(AuthSession);

  private get guest(): boolean {
    return !this.session.signedIn();
  }

  checkout(request: CheckoutRequest): Observable<OrderDto> {
    return this.api.post<OrderDto>(
      this.guest ? 'storefront/checkout' : 'orders/checkout',
      request,
      { withCredentials: true },
    );
  }

  getMyOrders(page = 1, size = 20): Observable<OrderPage> {
    return this.api.get<OrderPage>(this.guest ? 'storefront/orders' : 'orders/mine', {
      params: { page, size },
      withCredentials: true,
    });
  }

  getOrder(id: string): Observable<OrderDto> {
    const path = this.guest
      ? `storefront/orders/${encodeURIComponent(id)}`
      : `orders/${encodeURIComponent(id)}`;
    return this.api.get<OrderDto>(path, { withCredentials: true });
  }

  cancelOrder(id: string, version: string): Observable<OrderDto> {
    const path = this.guest
      ? `storefront/orders/${encodeURIComponent(id)}/cancel`
      : `orders/${encodeURIComponent(id)}/cancel`;
    return this.api.post<OrderDto>(path, { version }, { withCredentials: true });
  }

  getDigitalDeliveries(orderId: string): Observable<readonly DigitalDeliveryDto[]> {
    return this.api.get<readonly DigitalDeliveryDto[]>(
      `${this.guest ? 'storefront/orders' : 'orders'}/${encodeURIComponent(orderId)}/digital-deliveries`,
      { withCredentials: true },
    );
  }

  getMyShipments(orderId: string): Observable<readonly ShipmentSummary[]> {
    return this.api.get<readonly ShipmentSummary[]>(
      `${this.guest ? 'storefront/orders' : 'orders'}/${encodeURIComponent(orderId)}/shipments`,
      { withCredentials: true },
    );
  }

  requestAccessCode(email: string) {
    return this.api.post<{ readonly message: string }>(
      'storefront/access/request-code',
      { email },
      { withCredentials: true },
    );
  }

  verifyAccessCode(email: string, code: string) {
    return this.api.post<GuestVerificationResult>(
      'storefront/access/verify-code',
      { email, code },
      { withCredentials: true },
    );
  }

  getVerifiedEmail() {
    return this.api.get<GuestVerificationResult>('storefront/access/me', { withCredentials: true });
  }

  getPaymentSettings() {
    return this.api.get<GuestPaymentSettings>('storefront/settings', { withCredentials: true });
  }
}
