import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '@core/base';
import {
  AfterSalesSummaryDto,
  RecordRefundRequest,
  RecordReturnRequest,
  RefundResult,
  ReturnResult,
} from '../models/after-sales.dto';

@Injectable({ providedIn: 'root' })
export class AfterSalesService extends BaseApiService {
  getAdminAfterSales(orderId: string): Observable<AfterSalesSummaryDto> {
    return this.get<AfterSalesSummaryDto>(
      `admin/orders/${encodeURIComponent(orderId)}/after-sales`,
    );
  }

  recordRefund(orderId: string, body: RecordRefundRequest): Observable<RefundResult> {
    return this.post<RefundResult>(`admin/orders/${encodeURIComponent(orderId)}/refunds`, body);
  }

  recordReturn(orderId: string, body: RecordReturnRequest): Observable<ReturnResult> {
    return this.post<ReturnResult>(`admin/orders/${encodeURIComponent(orderId)}/returns`, body);
  }

  getCustomerAfterSales(orderId: string): Observable<AfterSalesSummaryDto> {
    return this.get<AfterSalesSummaryDto>(
      `orders/${encodeURIComponent(orderId)}/after-sales`,
      undefined,
      { withCredentials: true },
    );
  }
}
