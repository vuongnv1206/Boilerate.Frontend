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

interface OverviewFinanceDay {
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

interface OverviewChartBar {
  readonly date: string;
  readonly receivedX: number;
  readonly receivedY: number;
  readonly receivedHeight: number;
  readonly refundedX: number;
  readonly refundedY: number;
  readonly refundedHeight: number;
  readonly width: number;
  readonly captionX: number;
  readonly caption: string;
  readonly showCaption: boolean;
  readonly label: string;
}

interface OverviewChart {
  readonly zeroY: number;
  readonly netPoints: string;
  readonly bars: readonly OverviewChartBar[];
}

export interface OverviewAccessSnapshot {
  readonly work: string;
  readonly finance: boolean;
  readonly stock: string;
}

const OVERVIEW_MAX_DAYS = 90;
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

const OVERVIEW_ORDER_STATUS_LABELS: Readonly<Record<number, string>> = {
  1: 'Chờ thanh toán',
  2: 'Chờ xử lý',
  3: 'Đã hủy',
  4: 'Hết hạn',
  5: 'Hoàn tất',
  6: 'Đã đóng',
};

const OVERVIEW_RENEWAL_STATUS_LABELS: Readonly<Record<number, string>> = {
  1: 'Chờ khách nhập tài khoản',
  2: 'Chờ nhận xử lý',
  3: 'Đang xử lý',
  4: 'Chờ xác minh kết quả',
  5: 'Đã xác nhận gia hạn',
};

const DAY_MS = 86_400_000;

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export function emptyOverviewSection<T>(): OverviewSection<T> {
  return { data: null, loading: false, error: '', forbidden: false };
}

export function overviewToday(now: Date): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isOverviewDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    value >= '0001-01-02' &&
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function overviewAddDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function overviewRangeError(from: string, to: string, today: string): string {
  if (!isOverviewDate(from) || !isOverviewDate(to)) return 'Chọn đủ ngày bắt đầu và kết thúc.';
  if (from > to) return 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.';
  if (to > today) return 'Ngày kết thúc không được sau hôm nay theo giờ Việt Nam.';
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS + 1;
  return days > OVERVIEW_MAX_DAYS ? `Mỗi lần xem tối đa ${OVERVIEW_MAX_DAYS} ngày.` : '';
}

export function defaultAdminOverviewQuery(today: string): AdminOverviewQuery {
  return { from: overviewAddDays(today, -6), to: today, threshold: 5, page: 1, pageSize: 10 };
}

export function readAdminOverviewQuery(
  values: Readonly<Record<string, unknown>>,
  today: string,
): AdminOverviewQuery {
  const defaults = defaultAdminOverviewQuery(today);
  const from = isOverviewDate(values['from']) ? values['from'] : defaults.from;
  const to = isOverviewDate(values['to']) ? values['to'] : defaults.to;
  const validRange = !overviewRangeError(from, to, today);
  const threshold = parseSafeInt(values['threshold'], 0, OVERVIEW_MAX_THRESHOLD, 5);
  const requestedSize = parseSafeInt(values['pageSize'], 1, 50, 10);
  const pageSize = OVERVIEW_PAGE_SIZES.some((size) => size === requestedSize) ? requestedSize : 10;
  const page = parseSafeInt(values['page'], 1, Math.floor(2_147_483_647 / pageSize), 1);
  return {
    from: validRange ? from : defaults.from,
    to: validRange ? to : defaults.to,
    threshold,
    page,
    pageSize,
  };
}

export function adminOverviewQueryParams(
  query: AdminOverviewQuery,
): Record<string, string | number> {
  return {
    from: query.from,
    to: query.to,
    ...(query.threshold === 5 ? {} : { threshold: query.threshold }),
    ...(query.page === 1 ? {} : { page: query.page }),
    ...(query.pageSize === 10 ? {} : { pageSize: query.pageSize }),
  };
}

export function sameOverviewParams(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean {
  return (
    Object.keys(left).length === Object.keys(right).length &&
    Object.keys(right).every((key) => String(left[key]) === String(right[key]))
  );
}

export function overviewRangePreset(
  query: Pick<AdminOverviewQuery, 'from' | 'to'>,
  today: string,
): OverviewRangePreset {
  if (query.to !== today) return 'custom';
  if (query.from === today) return 'today';
  if (query.from === overviewAddDays(today, -6)) return '7';
  if (query.from === overviewAddDays(today, -29)) return '30';
  return 'custom';
}

export function overviewDateValue(date: string): Date | null {
  if (!isOverviewDate(date)) return null;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const result = new Date(0);
  result.setFullYear(year, month - 1, day);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function overviewDateString(date: Date | null): string {
  if (!date || !Number.isFinite(date.getTime())) return '';
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatOverviewMoney(value: string): string {
  return moneyFormatter.format(BigInt(value));
}

/** Only chart coordinates lose precision; every monetary label uses the original integer string. */
export function overviewChart(days: readonly OverviewFinanceDay[]): OverviewChart {
  const values = days.flatMap((day) => [
    BigInt(day.received),
    BigInt(day.refunded),
    BigInt(day.net),
  ]);
  const maximum = values.reduce((max, value) => (value > max ? value : max), 1n);
  const minimum = values.reduce((min, value) => (min < value ? min : value), 0n);
  const span = maximum - minimum;
  const y = (value: bigint): number => 16 + Number(((maximum - value) * 190_000n) / span) / 1000;
  const zeroY = y(0n);
  const step = 900 / Math.max(days.length, 1);
  const width = Math.max(1, Math.min(18, step * 0.32));
  const captionStep = Math.max(1, Math.ceil(days.length / 7));
  return {
    zeroY,
    netPoints: days
      .map((day, index) => `${30 + step * (index + 0.5)},${y(BigInt(day.net))}`)
      .join(' '),
    bars: days.map((day, index) => {
      const receivedY = y(BigInt(day.received));
      const refundedY = y(BigInt(day.refunded));
      return {
        date: day.date,
        receivedX: 30 + step * (index + 0.5) - width - 1,
        receivedY,
        receivedHeight: Math.max(0, zeroY - receivedY),
        refundedX: 30 + step * (index + 0.5) + 1,
        refundedY,
        refundedHeight: Math.max(0, zeroY - refundedY),
        width,
        captionX: 30 + step * (index + 0.5),
        caption: `${day.date.slice(8, 10)}/${day.date.slice(5, 7)}`,
        showCaption: index % captionStep === 0 || index === days.length - 1,
        label: `${day.date}: đã nhận ${formatOverviewMoney(day.received)}, đã hoàn ${formatOverviewMoney(day.refunded)}, thu ròng ${formatOverviewMoney(day.net)}`,
      };
    }),
  };
}

export function getOverviewWorkStatusLabel(
  group: OverviewWorkGroup,
  item: OverviewWorkItem,
): string {
  return (
    (group.kind === 'order'
      ? OVERVIEW_ORDER_STATUS_LABELS[item.status]
      : OVERVIEW_RENEWAL_STATUS_LABELS[item.status]) ?? 'Không xác định'
  );
}

export function getOverviewStockKindLabel(kind: OverviewFulfillmentKind): string {
  if (kind === OverviewFulfillmentKind.DigitalUnique) return 'Hàng số Unique';
  if (kind === OverviewFulfillmentKind.DigitalShared) return 'Nội dung Shared';
  return 'Hàng vật lý';
}

function parseSafeInt(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const parsed = typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}
