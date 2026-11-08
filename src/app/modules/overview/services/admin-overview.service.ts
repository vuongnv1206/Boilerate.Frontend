import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '@core/base';
import {
  OverviewDateRangeInput,
  OverviewFinance,
  OverviewStock,
  OverviewStockQueryInput,
  OverviewWork,
} from '../models/overview.dto';

@Injectable({ providedIn: 'root' })
export class AdminOverviewService extends BaseApiService {
  getWork(): Observable<OverviewWork> {
    return this.get<OverviewWork>('admin/overview/work');
  }

  getFinance(query: OverviewDateRangeInput): Observable<OverviewFinance> {
    return this.get<OverviewFinance>('admin/overview/finance', {
      from: query.from,
      to: query.to,
    });
  }

  getStock(query: OverviewStockQueryInput): Observable<OverviewStock> {
    return this.get<OverviewStock>('admin/overview/stock', {
      threshold: query.threshold,
      page: query.page,
      size: query.pageSize,
    });
  }
}
