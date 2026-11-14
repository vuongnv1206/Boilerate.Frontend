export enum OverviewFulfillmentKind {
  Physical = 1,
  DigitalUnique = 2,
  DigitalShared = 3,
  ManualExtension = 4,
}

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
  readonly fulfillmentKind: OverviewFulfillmentKind;
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

export interface AdminOverviewDto {
  readonly work: OverviewWork | null;
  readonly finance: OverviewFinance | null;
  readonly stock: OverviewStock | null;
}

export interface AdminOverviewQuery {
  readonly from: string;
  readonly to: string;
  readonly threshold: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface OverviewDateRangeInput {
  readonly from: string;
  readonly to: string;
}

export interface OverviewStockQueryInput {
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

interface OverviewSelectOption<T> {
  readonly label: string;
  readonly value: T;
}

export interface OverviewAccessSnapshot {
  readonly work: string;
  readonly finance: boolean;
  readonly stock: string;
}
export const OVERVIEW_MAX_THRESHOLD = 999;
export const OVERVIEW_PAGE_SIZES = [10, 20, 50] as const;

export const OVERVIEW_PAGE_SIZE_OPTIONS: OverviewSelectOption<number>[] = [
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
];

export const OVERVIEW_RANGE_OPTIONS: OverviewSelectOption<OverviewRangePreset>[] = [
  { label: 'Hôm nay', value: 'today' },
  { label: '7 ngày', value: '7' },
  { label: '30 ngày', value: '30' },
  { label: 'Tùy chọn', value: 'custom' },
];

export const OVERVIEW_WORK_LABELS: Readonly<Record<OverviewWorkKey, string>> = {
  'awaiting-payment': 'Đơn chờ thanh toán',
  'awaiting-processing': 'Đơn chờ hoàn tất',
  'needs-review': 'Đơn cần kiểm tra',
  'renewal-awaiting-work': 'Gia hạn chờ thực hiện',
  'renewal-pending-verification': 'Gia hạn chờ xác minh',
};

export const OVERVIEW_WORK_DESCRIPTIONS: Readonly<Record<OverviewWorkKey, string>> = {
  'awaiting-payment': 'Đơn chưa nhận tiền và còn thời hạn thanh toán.',
  'awaiting-processing': 'Đơn đang chờ thực hiện hoặc đang được xử lý.',
  'needs-review': 'Đơn đã nhận tiền cần kiểm tra trước khi tiếp tục.',
  'renewal-awaiting-work': 'Yêu cầu đã đủ điều kiện và đang chờ nhân viên thực hiện.',
  'renewal-pending-verification': 'Cần xác minh kết quả thực tế, kể cả khi đơn đã đóng.',
};
