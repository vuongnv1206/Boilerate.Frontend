import { Injectable } from '@angular/core';
import { EMPTY, Observable, expand, reduce, map } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import { createOperationId } from '@core/http/operation-id';
import { PagedResult, PageWire, fromPage } from '@core/http/pagination';
import {
  AdjustInventoryRequest,
  INVENTORY_PAGE_SIZE,
  InventoryBalanceDto,
  InventoryFilter,
  StockMovementDto,
} from '../models/inventory.dto';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  constructor(private readonly api: ApiService) {}

  initializeWarehouse(operationId = createOperationId()): Observable<string> {
    return this.api.post<string>('inventory/initialize', { operationId });
  }

  getBalances(filter?: InventoryFilter): Observable<PagedResult<InventoryBalanceDto>> {
    return this.api
      .get<PageWire<InventoryBalanceDto>>('inventory', {
        page: filter?.page ?? 1,
        size: filter?.size ?? INVENTORY_PAGE_SIZE,
        productId: filter?.productId,
        variantId: filter?.variantId,
      })
      .pipe(map(fromPage));
  }

  getAllProductBalances(productId: string): Observable<readonly InventoryBalanceDto[]> {
    return this.getBalances({ productId, page: 1, size: 100 }).pipe(
      expand((page) =>
        page.page * page.pageSize < page.total
          ? this.getBalances({ productId, page: page.page + 1, size: 100 })
          : EMPTY,
      ),
      reduce((rows: InventoryBalanceDto[], page) => [...rows, ...page.items], []),
    );
  }

  adjustStock(
    inventoryItemId: string,
    request: AdjustInventoryRequest,
  ): Observable<StockMovementDto> {
    return this.api.post<StockMovementDto>(
      `inventory/${encodeURIComponent(inventoryItemId)}/adjustments`,
      {
        ...request,
        inventoryItemId,
      },
    );
  }

  getMovements(
    inventoryItemId: string,
    page = 1,
    size = INVENTORY_PAGE_SIZE,
  ): Observable<PagedResult<StockMovementDto>> {
    return this.api
      .get<PageWire<StockMovementDto>>(
        `inventory/${encodeURIComponent(inventoryItemId)}/movements`,
        { page, size },
      )
      .pipe(map(fromPage));
  }
}
