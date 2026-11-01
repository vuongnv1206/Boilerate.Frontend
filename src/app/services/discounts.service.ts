import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/http/api-client';
import { DiscountDto, DiscountPage, SaveDiscountRequest } from '@models/discount.dto';

@Injectable({ providedIn: 'root' })
export class DiscountsService {
  private readonly api = inject(ApiClient);

  list(page: number, search: string, isActive: boolean | null): Observable<DiscountPage> {
    return this.api.get<DiscountPage>('admin/discounts', {
      params: {
        page,
        size: 20,
        ...(search ? { search } : {}),
        ...(isActive === null ? {} : { isActive }),
      },
    });
  }
  get(id: string): Observable<DiscountDto> {
    return this.api.get<DiscountDto>(`admin/discounts/${encodeURIComponent(id)}`);
  }
  create(request: SaveDiscountRequest): Observable<DiscountDto> {
    return this.api.post<DiscountDto>('admin/discounts', request);
  }
  update(id: string, version: string, request: SaveDiscountRequest): Observable<DiscountDto> {
    return this.api.put<DiscountDto>(`admin/discounts/${encodeURIComponent(id)}`, {
      ...request,
      version,
    });
  }
}
