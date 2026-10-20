import { describe, expect, it } from 'vitest';
import { filterItems, isValidItem, slugify } from './content-model';
import { DemoContentStore } from './demo-content-store';

describe('Demo content state', () => {
  it('searches Vietnamese without accents and combines status filtering', () => {
    const store = new DemoContentStore();
    const results = filterItems(store.collection('products'), 'den', 'published');
    expect(results).toHaveLength(2);
    expect(results.every((item) => item.status === 'published')).toBe(true);
    expect(slugify('  Đồ dùng đẹp! ')).toBe('do-dung-dep');
  });

  it('edits detached snapshots without changing saved content until save', () => {
    const store = new DemoContentStore();
    const snapshot = store.get('product-1');
    if (!snapshot) throw new Error('Expected seeded product.');
    snapshot.name = 'Tên mới';
    expect(store.get(snapshot.id)?.name).toBe('Túi Everyday Tote');
    store.save(snapshot);
    expect(store.get(snapshot.id)?.name).toBe('Tên mới');
  });

  it('keeps duplicates as independent drafts and archives only selected records', () => {
    const store = new DemoContentStore();
    const copy = store.duplicate('product-1');
    if (!copy) throw new Error('Expected duplicated product.');
    expect(copy.status).toBe('draft');
    expect(copy.id).not.toBe('product-1');
    store.setStatus(new Set([copy.id]), 'archived');
    expect(store.get(copy.id)?.status).toBe('archived');
    expect(store.get('product-1')?.status).toBe('published');
  });

  it('rejects invalid drafts without inserting them', () => {
    const store = new DemoContentStore();
    const draft = store.draft('products');
    const count = store.items().length;
    expect(isValidItem(draft)).toBe(false);
    expect(() => store.save(draft)).toThrow();
    expect(store.items()).toHaveLength(count);
  });
});
