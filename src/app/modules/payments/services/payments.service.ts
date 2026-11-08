import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '@core/base';
import {
  ConfirmPaymentRequest,
  PaymentPanelOrder,
  RetryFulfillmentRequest,
} from '../models/payment.dto';

@Injectable({ providedIn: 'root' })
export class PaymentsService extends BaseApiService {
  confirmPayment<TOrder = PaymentPanelOrder>(
    orderId: string,
    request: ConfirmPaymentRequest,
  ): Observable<TOrder> {
    return this.post<TOrder>(
      `admin/orders/${encodeURIComponent(orderId)}/payment-confirmations`,
      request,
    );
  }

  retryFulfillment<TOrder = PaymentPanelOrder>(
    orderId: string,
    request: RetryFulfillmentRequest,
  ): Observable<TOrder> {
    return this.post<TOrder>(`admin/orders/${encodeURIComponent(orderId)}/retry-fulfillment`, {
      version: request.version,
    });
  }
}
