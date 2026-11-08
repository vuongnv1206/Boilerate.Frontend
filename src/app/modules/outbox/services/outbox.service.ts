import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService, PagedResult } from '@core/base';
import { OutboxFilter, OutboxMessageDto } from '../models/outbox.dto';

@Injectable({ providedIn: 'root' })
export class OutboxService extends BaseApiService {
  getMessages(filter: OutboxFilter = {}): Observable<PagedResult<OutboxMessageDto>> {
    const params: Record<string, unknown> = {
      state: filter.state ?? undefined,
      page: filter.page ?? 1,
      size: filter.size ?? filter.pageSize ?? 20,
    };
    return this.getPageFrom<OutboxMessageDto>('outbox', params);
  }

  replay(id: string): Observable<void> {
    return this.api.post<void>(`outbox/${encodeURIComponent(id)}/replay`, null);
  }
}
