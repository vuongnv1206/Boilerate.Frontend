import { ContentStatus } from '../enums/content.enum';
import { ContentColumn } from '../enums/content-table.enum';

export type ContentStatusFilter = ContentStatus | 'all';

export interface ContentStatusOption {
  readonly label: string;
  readonly value: ContentStatusFilter;
}

export interface ContentColumnOption {
  readonly key: ContentColumn;
  readonly label: string;
}
