import {
  OVERVIEW_MAX_DAYS,
  OVERVIEW_MAX_THRESHOLD,
  OVERVIEW_PAGE_SIZES,
} from '@constants/admin-overview.constants';
import { AdminOverviewQuery, OverviewRangePreset } from '@models/admin-overview.dto';

const DAY_MS = 86_400_000;

export function overviewToday(now: Date): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function isOverviewDate(value: unknown): value is string {
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
  const threshold = integer(values['threshold'], 0, OVERVIEW_MAX_THRESHOLD, 5);
  const requestedSize = integer(values['pageSize'], 1, 50, 10);
  const pageSize = OVERVIEW_PAGE_SIZES.some((size) => size === requestedSize) ? requestedSize : 10;
  const page = integer(values['page'], 1, Math.floor(2_147_483_647 / pageSize), 1);
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

export function overviewRangePreset(query: AdminOverviewQuery, today: string): OverviewRangePreset {
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

function integer(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const parsed = typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}
