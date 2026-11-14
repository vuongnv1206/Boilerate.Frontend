export enum InventoryFulfillmentKind {
  Physical = 1,
  DigitalUnique = 2,
  DigitalShared = 3,
  ManualExtension = 4,
}

export interface InventoryBalanceDto {
  readonly id: string;
  readonly variantId: string;
  readonly locationId: string;
  readonly onHand: number;
  readonly reserved: number;
  readonly available: number;
  readonly version: string;
}

export type InventoryBalance = InventoryBalanceDto;

export interface StockMovementDto {
  readonly id: string;
  readonly inventoryItemId: string;
  readonly operationId: string;
  readonly delta: number;
  readonly quantityAfter: number;
  readonly reason: string;
  readonly actorId: string | null;
  readonly createdAt: string;
}

export type InventoryMovement = StockMovementDto;

export interface AdjustInventoryRequest {
  readonly inventoryItemId: string;
  readonly version: string;
  readonly operationId: string;
  readonly delta: number;
  readonly reason: string;
}

export interface InventoryFilter {
  readonly page?: number;
  readonly size?: number;
  readonly productId?: string;
  readonly variantId?: string;
}

export interface DigitalStockInputDto {
  readonly reference: string;
  readonly content: string;
}

export interface DigitalInventoryItemDto {
  readonly id: string;
  readonly productId: string;
  readonly variantId: string;
  readonly fulfillmentKind: number;
  readonly reference: string;
  readonly state: number;
  readonly version: string;
  readonly productVersion: string;
}

export type DigitalStock = DigitalInventoryItemDto;

export interface DigitalAvailabilityDto {
  readonly variantId: string;
  readonly total: number;
  readonly availableCount: number;
  readonly disabledCount: number;
  readonly reservedCount: number;
  readonly deliveredCount: number;
}

export interface ImportDigitalItemsRequest {
  readonly productId: string;
  readonly variantId: string;
  readonly version: string;
  readonly items: readonly DigitalStockInputDto[];
  readonly operationId?: string;
}

export interface DigitalDeliverySpecRequest {
  readonly productId: string;
  readonly variantId: string;
  readonly version: string;
  readonly content: string;
  readonly isActive: boolean;
}

export interface SetDigitalAvailabilityRequest {
  readonly productId: string;
  readonly variantId: string;
  readonly stockItemId: string;
  readonly version: string;
  readonly isAvailable: boolean;
}

export interface RevealedDigitalSecretDto {
  readonly id: string;
  readonly content: string;
}

export interface InventoryVariantSummary {
  readonly id: string;
  readonly sku: string;
  readonly inStock: boolean;
  readonly isActive: boolean;
  readonly isDefault: boolean;
}

export interface InventoryProductContext {
  readonly id: string;
  readonly version: string;
  readonly fulfillmentKind: number;
  readonly variants: readonly InventoryVariantSummary[];
}

export type InventoryPanelMode = 'inventory' | 'digital' | null;
export type InventoryStockLevelFilter = 'all' | 'low' | 'out';

interface InventorySelectOption<T = string> {
  readonly label: string;
  readonly value: T;
}

export const MAX_STOCK_QUANTITY = 2147483647;
export const LOW_STOCK_THRESHOLD = 5;
export const INVENTORY_PAGE_SIZE = 20;

export const DIGITAL_STOCK_STATE_LABELS: Readonly<Record<number, string>> = {
  1: 'Sẵn sàng',
  2: 'Ngừng cung cấp',
  3: 'Đã giữ cho đơn',
  4: 'Đã giao',
};

export const INVENTORY_STOCK_FILTER_OPTIONS: InventorySelectOption<InventoryStockLevelFilter>[] = [
  { label: 'Tất cả mức tồn', value: 'all' },
  { label: 'Sắp hết hàng (≤ 5)', value: 'low' },
  { label: 'Hết hàng khả dụng (0)', value: 'out' },
];
