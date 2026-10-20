import { describe, expect, it } from 'vitest';
import { ContentColumn } from '../enums/content-table.enum';
import { CollectionKey } from '../enums/content.enum';
import { ContentViewStore } from './content-view.store';

describe('Content view preferences', () => {
  it('keeps collection preferences independent and returns detached columns', () => {
    const views = new ContentViewStore();
    const products = views.get(CollectionKey.Products);
    products.query = 'đèn';
    products.columns.pop();
    expect(views.get(CollectionKey.Products).query).toBe('');
    views.set(CollectionKey.Products, products);
    products.columns.push(ContentColumn.Updated);
    const restored = views.get(CollectionKey.Products);
    expect(restored.query).toBe('đèn');
    expect(restored.columns).toEqual([
      ContentColumn.Status,
      ContentColumn.Category,
      ContentColumn.Price,
    ]);
    restored.columns.pop();
    expect(views.get(CollectionKey.Products).columns).toHaveLength(3);
    expect(views.get(CollectionKey.Categories).query).toBe('');
  });
});
