import { ProductFulfillmentKind } from '@enums/product.enum';

export interface CatalogPage<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly pageNumber: number;
  readonly pageSize: number;
}

export interface InventoryBalance {
  readonly id: string;
  readonly variantId: string;
  readonly locationId: string;
  readonly onHand: number;
  readonly reserved: number;
  readonly available: number;
  readonly version: string;
}

export interface InventoryMovement {
  readonly id: string;
  readonly inventoryItemId: string;
  readonly operationId: string;
  readonly delta: number;
  readonly quantityAfter: number;
  readonly reason: string;
  readonly actorId: string;
  readonly createdAt: string;
}

export interface AdjustInventory {
  readonly inventoryItemId: string;
  readonly version: string;
  readonly operationId: string;
  readonly delta: number;
  readonly reason: string;
}

export interface DigitalStock {
  readonly id: string;
  readonly productId: string;
  readonly variantId: string;
  readonly fulfillmentKind: ProductFulfillmentKind;
  readonly reference: string;
  readonly state: number;
  readonly version: string;
  readonly productVersion: string;
}

export interface DigitalStockInput {
  readonly reference: string;
  readonly content: string;
}
