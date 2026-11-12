import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import {
  OverviewDateRangeInput,
  OverviewFinance,
  OverviewStock,
  OverviewStockQueryInput,
  OverviewWork,
} from '../models/overview.dto';

@Injectable({ providedIn: 'root' })
export class AdminOverviewService {
  constructor(private readonly api: ApiService) {}

  getWork(): Observable<OverviewWork> {
    return this.api.get<OverviewWork>('admin/overview/work');
  }

  getFinance(query: OverviewDateRangeInput): Observable<OverviewFinance> {
    return this.api.get<OverviewFinance>('admin/overview/finance', {
      from: query.from,
      to: query.to,
    });
  }

  getStock(query: OverviewStockQueryInput): Observable<OverviewStock> {
    return this.api.get<OverviewStock>('admin/overview/stock', {
      threshold: query.threshold,
      page: query.page,
      size: query.pageSize,
    });
  }
}
