import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';

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

interface DigitalStockInputDto {
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
const INVENTORY_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u;

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

const requiredTrimmed: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

const utf8Max8000: ValidatorFn = (control) =>
  typeof control.value === 'string' && new TextEncoder().encode(control.value).length <= 8000
    ? null
    : { contentSize: true };

export function createInventoryAdjustmentForm() {
  return new FormGroup({
    delta: new FormControl<number | null>(null, [
      Validators.required,
      (control) =>
        typeof control.value === 'number' &&
        Number.isInteger(control.value) &&
        control.value !== 0 &&
        Math.abs(control.value) <= MAX_STOCK_QUANTITY
          ? null
          : { delta: true },
    ]),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [requiredTrimmed, Validators.maxLength(1000)],
    }),
  });
}

export function createDigitalContentForm() {
  return new FormGroup({
    reference: new FormControl('', {
      nonNullable: true,
      validators: [
        requiredTrimmed,
        Validators.maxLength(100),
        Validators.pattern(INVENTORY_CODE_PATTERN),
      ],
    }),
    content: new FormControl('', {
      nonNullable: true,
      validators: [requiredTrimmed, utf8Max8000],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
  });
}

export function createWorkspaceDigitalImportForm() {
  return new FormGroup({
    productId: new FormControl('', {
      nonNullable: true,
      validators: [requiredTrimmed, Validators.maxLength(64)],
    }),
    version: new FormControl('', {
      nonNullable: true,
      validators: [requiredTrimmed, Validators.maxLength(128)],
    }),
    batch: new FormControl('', {
      nonNullable: true,
      validators: [requiredTrimmed],
    }),
  });
}

interface ParsedDigitalBatch {
  readonly items: readonly DigitalStockInputDto[];
  readonly error: string | null;
}

export function parseDigitalBatchLines(raw: string): ParsedDigitalBatch {
  const lines = raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return { items: [], error: 'Nhập ít nhất một dòng theo mẫu MA_THAM_CHIEU|NOI_DUNG.' };
  }
  const items: DigitalStockInputDto[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const separator = line.indexOf('|');
    if (separator <= 0 || separator === line.length - 1) {
      return {
        items: [],
        error: `Dòng ${index + 1} chưa đúng định dạng MA_THAM_CHIEU|NOI_DUNG.`,
      };
    }
    const reference = line.slice(0, separator).trim();
    const content = line.slice(separator + 1).trim();
    if (!INVENTORY_CODE_PATTERN.test(reference)) {
      return {
        items: [],
        error: `Mã tham chiếu ở dòng ${index + 1} chỉ gồm chữ, số, dấu chấm, gạch nối hoặc gạch dưới (tối đa 100 ký tự).`,
      };
    }
    const normalizedRef = reference.toUpperCase();
    if (seen.has(normalizedRef)) {
      return {
        items: [],
        error: `Mã tham chiếu "${reference}" bị trùng ở dòng ${index + 1}.`,
      };
    }
    if (!content || new TextEncoder().encode(content).length > 8000) {
      return {
        items: [],
        error: `Nội dung ở dòng ${index + 1} phải từ 1 đến 8.000 byte UTF-8.`,
      };
    }
    seen.add(normalizedRef);
    items.push({ reference, content });
  }
  return { items, error: null };
}
