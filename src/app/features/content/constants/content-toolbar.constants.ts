import { ContentColumn } from '../enums/content-table.enum';
import { ContentStatus } from '../enums/content.enum';
import { ContentColumnOption, ContentStatusOption } from '../models/content-view.model';

export const CONTENT_ALL_STATUSES = 'all' as const;

export const CONTENT_STATUS_OPTIONS = [
  { label: 'Tất cả trạng thái', value: CONTENT_ALL_STATUSES },
  { label: 'Đã xuất bản', value: ContentStatus.Published },
  { label: 'Bản nháp', value: ContentStatus.Draft },
  { label: 'Đã lưu trữ', value: ContentStatus.Archived },
] as const satisfies readonly ContentStatusOption[];

export const CONTENT_COLUMN_OPTIONS = [
  { key: ContentColumn.Status, label: 'Trạng thái' },
  { key: ContentColumn.Category, label: 'Danh mục' },
  { key: ContentColumn.Price, label: 'Giá bán' },
  { key: ContentColumn.Updated, label: 'Cập nhật gần nhất' },
] as const satisfies readonly ContentColumnOption[];
