import { Injectable } from '@angular/core';
import { CONTENT_CSV_URL_LIFETIME_MS } from '../constants/content-table.constants';
import { STATUS_LABELS } from '../constants/content.constants';
import { CollectionKey } from '../enums/content.enum';
import { ContentItem } from '../models/content-item';

export function contentCsv(items: readonly ContentItem[]): string {
  const rows = [
    ['Tên', 'Slug', 'Trạng thái', 'Danh mục'],
    ...items.map((item) => [item.name, item.slug, STATUS_LABELS[item.status], item.category]),
  ];
  return rows
    .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
}

@Injectable()
export class ContentExport {
  download(items: readonly ContentItem[], collection: CollectionKey): void {
    const url = URL.createObjectURL(
      new Blob(['\ufeff', contentCsv(items)], { type: 'text/csv;charset=utf-8;' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${collection}-demo.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), CONTENT_CSV_URL_LIFETIME_MS);
  }
}
