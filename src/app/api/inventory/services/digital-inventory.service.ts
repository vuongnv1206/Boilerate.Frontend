import { Injectable } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import { createOperationId } from '@core/http/operation-id';
import { PagedResult, PageWire, fromPage } from '@core/http/pagination';
import {
  DigitalAvailabilityDto,
  DigitalDeliverySpecRequest,
  DigitalInventoryItemDto,
  INVENTORY_PAGE_SIZE,
  ImportDigitalItemsRequest,
  RevealedDigitalSecretDto,
  SetDigitalAvailabilityRequest,
} from '../models/inventory.dto';

@Injectable({ providedIn: 'root' })
export class DigitalInventoryService {
  constructor(private readonly api: ApiService) {}

  getItems(
    variantId: string,
    page = 1,
    size = INVENTORY_PAGE_SIZE,
  ): Observable<PagedResult<DigitalInventoryItemDto>> {
    return this.api
      .get<PageWire<DigitalInventoryItemDto>>(
        `digital-inventory/variants/${encodeURIComponent(variantId)}`,
        { page, size },
      )
      .pipe(map(fromPage));
  }

  getAvailability(variantId: string): Observable<DigitalAvailabilityDto> {
    return this.getItems(variantId, 1, 100).pipe(
      expand((page) =>
        page.page * page.pageSize < page.total
          ? this.getItems(variantId, page.page + 1, 100)
          : EMPTY,
      ),
      reduce((rows: DigitalInventoryItemDto[], page) => [...rows, ...page.items], []),
      map((items) => ({
        variantId,
        total: items.length,
        availableCount: items.filter((item) => item.state === 1).length,
        disabledCount: items.filter((item) => item.state === 2).length,
        reservedCount: items.filter((item) => item.state === 3).length,
        deliveredCount: items.filter((item) => item.state === 4).length,
      })),
    );
  }

  importBatch(
    variantId: string,
    request: ImportDigitalItemsRequest,
    operationId = request.operationId ?? createOperationId(),
  ): Observable<readonly DigitalInventoryItemDto[]> {
    return this.api.post<readonly DigitalInventoryItemDto[]>(
      `digital-inventory/variants/${encodeURIComponent(variantId)}/items`,
      {
        ...request,
        variantId,
        operationId,
      },
    );
  }

  updateDeliverySpec(
    variantId: string,
    request: DigitalDeliverySpecRequest,
  ): Observable<DigitalInventoryItemDto> {
    return this.api.put<DigitalInventoryItemDto>(
      `digital-inventory/variants/${encodeURIComponent(variantId)}/shared-content`,
      {
        ...request,
        variantId,
      },
    );
  }

  setItemAvailability(
    variantId: string,
    stockItemId: string,
    request: SetDigitalAvailabilityRequest,
  ): Observable<DigitalInventoryItemDto> {
    return this.api.put<DigitalInventoryItemDto>(
      `digital-inventory/variants/${encodeURIComponent(variantId)}/items/${encodeURIComponent(stockItemId)}/availability`,
      {
        ...request,
        variantId,
        stockItemId,
      },
    );
  }

  revealSecret(itemId: string): Observable<RevealedDigitalSecretDto> {
    return this.api.post<RevealedDigitalSecretDto>(
      `digital-inventory/items/${encodeURIComponent(itemId)}/reveal`,
      {},
    );
  }
}
