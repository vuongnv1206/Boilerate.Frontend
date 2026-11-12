import { PaginationResponse } from '../http/pagination';

export interface PaginationParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly keyword?: string;
  readonly orderBy?: readonly string[];
}

/** Commerce Backend Page<T>(Items, Total, PageNumber, PageSize) */
export interface PageWire<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly pageNumber: number;
  readonly pageSize: number;
}

/** Outbox Backend OutboxMessagePageDto(Total, Page, Size, Items) */
interface OutboxPageWire<T> {
  readonly total: number;
  readonly page: number;
  readonly size: number;
  readonly items: readonly T[];
}

export interface PagedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export type AnyPagedWire<T> =
  PagedResult<T> | PaginationResponse<T> | PageWire<T> | OutboxPageWire<T> | readonly T[];

/** Normalizes every Backend pagination contract into a single uniform PagedResult<T>. */
export function normalizePagedResult<T>(
  raw: AnyPagedWire<T>,
  fallbackPageSize = 20,
): PagedResult<T> {
  if (Array.isArray(raw)) {
    const size = Math.max(1, raw.length || fallbackPageSize);
    return {
      items: raw,
      total: raw.length,
      page: 1,
      pageSize: size,
      totalPages: raw.length > 0 ? 1 : 0,
    };
  }
  if ('data' in raw) {
    const pageSize = Math.max(1, raw.pageSize || fallbackPageSize);
    return {
      items: raw.data,
      total: raw.totalCount,
      page: Math.max(1, raw.currentPage || 1),
      pageSize,
      totalPages: raw.totalPages ?? Math.ceil(raw.totalCount / pageSize),
    };
  }
  if ('totalPages' in raw && 'pageSize' in raw) {
    return raw;
  }
  if ('pageNumber' in raw) {
    const pageSize = Math.max(1, raw.pageSize || fallbackPageSize);
    return {
      items: raw.items,
      total: raw.total,
      page: Math.max(1, raw.pageNumber || 1),
      pageSize,
      totalPages: Math.ceil(raw.total / pageSize),
    };
  }
  const outbox = raw as OutboxPageWire<T>;
  const pageSize = Math.max(1, outbox.size || fallbackPageSize);
  return {
    items: outbox.items,
    total: outbox.total,
    page: Math.max(1, outbox.page || 1),
    pageSize,
    totalPages: Math.ceil(outbox.total / pageSize),
  };
}
