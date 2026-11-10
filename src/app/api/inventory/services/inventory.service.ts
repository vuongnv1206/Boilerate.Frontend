import { Injectable } from '@angular/core';
import { EMPTY, Observable, expand, reduce } from 'rxjs';
import { BaseApiService, PagedResult } from '@core/base';
import { createOperationId } from '@core/http/operation-id';
import {
  AdjustInventoryRequest,
  INVENTORY_PAGE_SIZE,
  InventoryBalanceDto,
  InventoryFilter,
  StockMovementDto,
} from '../models/inventory.dto';

@Injectable({ providedIn: 'root' })
export class InventoryService extends BaseApiService {
  initializeWarehouse(operationId = createOperationId()): Observable<string> {
    return this.post<string>('inventory/initialize', { operationId });
  }

  getBalances(filter?: InventoryFilter): Observable<PagedResult<InventoryBalanceDto>> {
    return this.getPageFrom<InventoryBalanceDto>('inventory', {
      page: filter?.page ?? 1,
      size: filter?.size ?? INVENTORY_PAGE_SIZE,
      productId: filter?.productId,
      variantId: filter?.variantId,
    });
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
    return this.post<StockMovementDto>(
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
    return this.getPageFrom<StockMovementDto>(
      `inventory/${encodeURIComponent(inventoryItemId)}/movements`,
      { page, size },
    );
  }
}
