import { describe, expect, it } from 'vitest';
import { CollectionKey } from '../enums/content.enum';
import { createContentDraft } from '../models/content-item';
import { contentCsv } from './content-export';

describe('Content CSV export', () => {
  it('quotes punctuation and embedded newlines while retaining Vietnamese labels', () => {
    const csv = contentCsv([
      { ...createContentDraft(CollectionKey.Products), name: 'Đèn "A",\nđẹp', slug: 'den-a' },
    ]);
    expect(csv).toContain('"Tên","Slug","Trạng thái","Danh mục"\r\n');
    expect(csv).toContain('"Đèn ""A"",\nđẹp","den-a","Bản nháp"');
  });
});
