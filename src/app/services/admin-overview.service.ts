import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/http/api-client';
import {
  AdminOverviewQuery,
  OverviewFinance,
  OverviewStock,
  OverviewWork,
} from '@models/admin-overview.dto';

@Injectable({ providedIn: 'root' })
export class AdminOverviewService {
  private readonly api = inject(ApiClient);

  work(): Observable<OverviewWork> {
    return this.api.get<OverviewWork>('admin/overview/work');
  }

  finance(query: Pick<AdminOverviewQuery, 'from' | 'to'>): Observable<OverviewFinance> {
    return this.api.get<OverviewFinance>('admin/overview/finance', {
      params: { from: query.from, to: query.to },
    });
  }

  stock(
    query: Pick<AdminOverviewQuery, 'threshold' | 'page' | 'pageSize'>,
  ): Observable<OverviewStock> {
    return this.api.get<OverviewStock>('admin/overview/stock', {
      params: { threshold: query.threshold, page: query.page, size: query.pageSize },
    });
  }
}
