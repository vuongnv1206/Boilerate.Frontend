import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import { PagedResult, pagedResult } from '@core/http/pagination';
import { OutboxFilter, OutboxMessageDto } from '../models/outbox.dto';

/** Backend `OutboxMessagePageDto(Total, Page, Size, Items)`. */
interface OutboxPageWire {
  readonly total: number;
  readonly page: number;
  readonly size: number;
  readonly items: readonly OutboxMessageDto[];
}

@Injectable({ providedIn: 'root' })
export class OutboxService {
  constructor(private readonly api: ApiService) {}

  getMessages(filter: OutboxFilter = {}): Observable<PagedResult<OutboxMessageDto>> {
    const params: Record<string, unknown> = {
      state: filter.state ?? undefined,
      page: filter.page ?? 1,
      size: filter.size ?? filter.pageSize ?? 20,
    };
    return this.api
      .get<OutboxPageWire>('outbox', params)
      .pipe(map((raw) => pagedResult(raw.items, raw.total, raw.page, raw.size)));
  }

  replay(id: string): Observable<void> {
    return this.api.post<void>(`outbox/${encodeURIComponent(id)}/replay`, null);
  }
}
