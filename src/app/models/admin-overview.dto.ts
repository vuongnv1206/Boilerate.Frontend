import { ProductFulfillmentKind } from './order.dto';

export type OverviewWorkKey =
  | 'awaiting-payment'
  | 'awaiting-processing'
  | 'needs-review'
  | 'renewal-awaiting-work'
  | 'renewal-pending-verification';

export interface OverviewWorkItem {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly name: string | null;
  readonly sku: string | null;
  readonly status: number;
  readonly createdAtUtc: string;
}

export interface OverviewWorkGroup {
  readonly key: OverviewWorkKey;
  readonly kind: 'order' | 'renewal';
  readonly total: number;
  readonly items: readonly OverviewWorkItem[];
}

export interface OverviewWork {
  readonly generatedAtUtc: string;
  readonly groups: readonly OverviewWorkGroup[];
}

export interface OverviewFinanceDay {
  readonly date: string;
  readonly received: string;
  readonly refunded: string;
  readonly net: string;
}

export interface OverviewFinance {
  readonly generatedAtUtc: string;
  readonly from: string;
  readonly to: string;
  readonly timeZone: string;
  readonly currency: string;
  readonly received: string;
  readonly refunded: string;
  readonly net: string;
  readonly days: readonly OverviewFinanceDay[];
}

export interface OverviewStockItem {
  readonly productId: string;
  readonly variantId: string;
  readonly productName: string;
  readonly sku: string;
  readonly fulfillmentKind: ProductFulfillmentKind;
  readonly available: number;
}

export interface OverviewStock {
  readonly generatedAtUtc: string;
  readonly threshold: number;
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly total: number;
  readonly items: readonly OverviewStockItem[];
}

export interface AdminOverviewQuery {
  readonly from: string;
  readonly to: string;
  readonly threshold: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface OverviewSection<T> {
  readonly data: T | null;
  readonly loading: boolean;
  readonly error: string;
  readonly forbidden: boolean;
}

export type OverviewRangePreset = 'today' | '7' | '30' | 'custom';
