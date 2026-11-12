import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { ApiService } from '@core/http/api.service';
import { DigitalDeliveryDto } from '../models/payment.dto';

@Injectable({ providedIn: 'root' })
export class DigitalDeliveriesService {
  constructor(
    private readonly api: ApiService,
    private readonly session: AuthSession,
  ) {}

  getAdminDeliveries(orderId: string): Observable<readonly DigitalDeliveryDto[]> {
    return this.api.get<readonly DigitalDeliveryDto[]>(
      `admin/orders/${encodeURIComponent(orderId)}/digital-deliveries`,
    );
  }

  getCustomerDeliveries(orderId: string): Observable<readonly DigitalDeliveryDto[]> {
    const prefix = this.session.signedIn() ? 'orders' : 'storefront/orders';
    return this.api.get<readonly DigitalDeliveryDto[]>(
      `${prefix}/${encodeURIComponent(orderId)}/digital-deliveries`,
      undefined,
      { withCredentials: true },
    );
  }
}
