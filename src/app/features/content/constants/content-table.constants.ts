import { ContentColumn } from '../enums/content-table.enum';

export const CONTENT_DEFAULT_COLUMNS = [
  ContentColumn.Status,
  ContentColumn.Category,
  ContentColumn.Price,
  ContentColumn.Updated,
] as const;

export const CONTENT_PAGE_SIZES = [10, 20, 50] as const;
export const CONTENT_DEFAULT_PAGE_SIZE = CONTENT_PAGE_SIZES[0];
export const CONTENT_CSV_URL_LIFETIME_MS = 1000;
