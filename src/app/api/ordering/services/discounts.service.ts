import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseCrudService } from '@core/base';
import {
  DiscountDto,
  DiscountListFilter,
  DiscountPage,
  SaveDiscountRequest,
  UpdateDiscountRequest,
} from '../models/discount.dto';

@Injectable({ providedIn: 'root' })
export class DiscountsService extends BaseCrudService<
  DiscountDto,
  SaveDiscountRequest,
  UpdateDiscountRequest,
  DiscountListFilter
> {
  protected readonly endpoint = 'admin/discounts';

  listDiscounts(page: number, search: string, isActive: boolean | null): Observable<DiscountPage> {
    return this.get<DiscountPage>(this.endpoint, {
      page,
      size: 20,
      ...(search ? { search } : {}),
      ...(isActive === null ? {} : { isActive }),
    });
  }

  updateDiscount(
    id: string,
    version: string,
    request: SaveDiscountRequest,
  ): Observable<DiscountDto> {
    return this.update(id, { ...request, version });
  }
}
