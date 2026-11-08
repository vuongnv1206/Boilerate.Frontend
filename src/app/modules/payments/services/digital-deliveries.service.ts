import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { BaseApiService } from '@core/base';
import { DigitalDeliveryDto } from '../models/payment.dto';

@Injectable({ providedIn: 'root' })
export class DigitalDeliveriesService extends BaseApiService {
  constructor(private readonly session: AuthSession) {
    super();
  }

  getAdminDeliveries(orderId: string): Observable<readonly DigitalDeliveryDto[]> {
    return this.get<readonly DigitalDeliveryDto[]>(
      `admin/orders/${encodeURIComponent(orderId)}/digital-deliveries`,
    );
  }

  getCustomerDeliveries(orderId: string): Observable<readonly DigitalDeliveryDto[]> {
    const prefix = this.session.signedIn() ? 'orders' : 'storefront/orders';
    return this.get<readonly DigitalDeliveryDto[]>(
      `${prefix}/${encodeURIComponent(orderId)}/digital-deliveries`,
      undefined,
      { withCredentials: true },
    );
  }
}
