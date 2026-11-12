import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import { DiscountDto, DiscountPage, SaveDiscountRequest } from '../models/discount.dto';

@Injectable({ providedIn: 'root' })
export class DiscountsService {
  private readonly basePath = 'admin/discounts';

  constructor(private readonly api: ApiService) {}

  listDiscounts(page: number, search: string, isActive: boolean | null): Observable<DiscountPage> {
    return this.api.get<DiscountPage>(this.basePath, { page, size: 20, search, isActive });
  }

  getById(id: string): Observable<DiscountDto> {
    return this.api.get<DiscountDto>(`${this.basePath}/${encodeURIComponent(id)}`);
  }

  create(request: SaveDiscountRequest): Observable<DiscountDto> {
    return this.api.post<DiscountDto>(this.basePath, request);
  }

  updateDiscount(
    id: string,
    version: string,
    request: SaveDiscountRequest,
  ): Observable<DiscountDto> {
    return this.api.put<DiscountDto>(`${this.basePath}/${encodeURIComponent(id)}`, {
      ...request,
      version,
    });
  }
}
