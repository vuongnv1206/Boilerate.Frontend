import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import {
  ConfirmPaymentRequest,
  PaymentPanelOrder,
  RetryFulfillmentRequest,
} from '../models/payment.dto';

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  constructor(private readonly api: ApiService) {}

  confirmPayment<TOrder = PaymentPanelOrder>(
    orderId: string,
    request: ConfirmPaymentRequest,
  ): Observable<TOrder> {
    return this.api.post<TOrder>(
      `admin/orders/${encodeURIComponent(orderId)}/payment-confirmations`,
      request,
    );
  }

  retryFulfillment<TOrder = PaymentPanelOrder>(
    orderId: string,
    request: RetryFulfillmentRequest,
  ): Observable<TOrder> {
    return this.api.post<TOrder>(`admin/orders/${encodeURIComponent(orderId)}/retry-fulfillment`, {
      version: request.version,
    });
  }
}
