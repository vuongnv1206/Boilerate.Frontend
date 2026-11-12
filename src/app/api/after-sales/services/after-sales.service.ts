import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import {
  AfterSalesSummaryDto,
  RecordRefundRequest,
  RecordReturnRequest,
  RefundResult,
  ReturnResult,
} from '../models/after-sales.dto';

@Injectable({ providedIn: 'root' })
export class AfterSalesService {
  constructor(private readonly api: ApiService) {}

  getAdminAfterSales(orderId: string): Observable<AfterSalesSummaryDto> {
    return this.api.get<AfterSalesSummaryDto>(
      `admin/orders/${encodeURIComponent(orderId)}/after-sales`,
    );
  }

  recordRefund(orderId: string, body: RecordRefundRequest): Observable<RefundResult> {
    return this.api.post<RefundResult>(`admin/orders/${encodeURIComponent(orderId)}/refunds`, body);
  }

  recordReturn(orderId: string, body: RecordReturnRequest): Observable<ReturnResult> {
    return this.api.post<ReturnResult>(`admin/orders/${encodeURIComponent(orderId)}/returns`, body);
  }

  getCustomerAfterSales(orderId: string): Observable<AfterSalesSummaryDto> {
    return this.api.get<AfterSalesSummaryDto>(
      `orders/${encodeURIComponent(orderId)}/after-sales`,
      undefined,
      { withCredentials: true },
    );
  }
}
