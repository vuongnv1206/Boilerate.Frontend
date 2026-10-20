import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import {
  CONTENT_LIMITS,
  ContentItem,
  createContentDraft,
  filterItems,
  slugify,
} from '../models/content-item';
import { MockContentService } from './mock-content.service';

async function product(service: MockContentService, id = 'product-1'): Promise<ContentItem> {
  const item = await firstValueFrom(service.getById(id));
  if (!item) throw new Error('Expected seeded product.');
  return item;
}

describe('Mock content data service', () => {
  it('preserves the UI fixtures and supports accent-insensitive search', async () => {
    const service = new MockContentService();
    expect(await firstValueFrom(service.collectionCounts$)).toEqual({
      products: 14,
      categories: 6,
      types: 3,
    });
    const items = await firstValueFrom(service.getCollection('products'));
    expect(filterItems(items, 'den', 'published')).toHaveLength(2);
    expect(slugify('  Đồ dùng đẹp! ')).toBe('do-dung-dep');
  });

  it('keeps requests cold and detaches both read and write snapshots', async () => {
    const service = new MockContentService();
    const item = await product(service);
    item.name = 'Tên đã sửa';
    expect((await product(service)).name).toBe('Túi Everyday Tote');
    const write = service.save(item);
    expect((await product(service)).name).toBe('Túi Everyday Tote');
    item.name = 'Đã thay đổi sau khi gọi';
    const saved = await firstValueFrom(write);
    expect(saved.name).toBe('Tên đã sửa');
    saved.name = 'Chỉ sửa response';
    expect((await product(service)).name).toBe('Tên đã sửa');
    const collection = await firstValueFrom(service.getCollection('products'));
    const first = collection[0];
    if (!first) throw new Error('Expected collection item.');
    first.name = 'Chỉ sửa collection response';
    expect((await product(service)).name).toBe('Tên đã sửa');
  });

  it('publishes collection changes and canonical metadata, then updates navigation counts', async () => {
    const service = new MockContentService();
    const counts: number[] = [];
    const productNames: string[][] = [];
    const countSubscription = service.collectionCounts$.subscribe((value) =>
      counts.push(value.products),
    );
    const collectionSubscription = service
      .getCollection('products')
      .subscribe((items) => productNames.push(items.map((item) => item.name)));
    const draft = { ...createContentDraft('products'), name: 'Bản mới', slug: 'ban-moi' };
    await firstValueFrom(service.save(draft));
    const updated = await firstValueFrom(service.setStatus([draft.id], 'published'));
    expect(updated[0]?.status).toBe('published');
    expect(updated[0]?.updatedAt).toBe((await product(service, draft.id)).updatedAt);
    expect((await product(service)).status).toBe('published');
    const remove = service.remove([draft.id]);
    expect(await firstValueFrom(service.getById(draft.id))).toBeDefined();
    await firstValueFrom(remove);
    expect(await firstValueFrom(service.getById(draft.id))).toBeUndefined();
    expect(counts).toEqual([14, 15, 14]);
    expect(productNames[1]?.[0]).toBe('Bản mới');
    countSubscription.unsubscribe();
    collectionSubscription.unsubscribe();
  });

  it('duplicates a maximum-length name into a valid independent draft', async () => {
    const service = new MockContentService();
    const original = await product(service);
    await firstValueFrom(service.save({ ...original, name: 'A'.repeat(CONTENT_LIMITS.name) }));
    const duplicate = service.duplicate(original.id);
    expect((await firstValueFrom(service.getCollection('products'))).length).toBe(14);
    const copy = await firstValueFrom(duplicate);
    expect(copy?.name.length).toBe(CONTENT_LIMITS.name);
    expect(copy?.name.endsWith(' (bản sao)')).toBe(true);
    expect(copy?.id).not.toBe(original.id);
    expect(copy?.slug).not.toBe(original.slug);
    expect(copy?.status).toBe('draft');
    expect((await product(service)).status).toBe('published');
  });

  it.each(Object.entries(CONTENT_LIMITS))(
    'rejects an overlong %s before mutating records',
    async (key, limit) => {
      const service = new MockContentService();
      const original = await product(service);
      const invalid = { ...original, [key]: 'a'.repeat(limit + 1) };
      await expect(firstValueFrom(service.save(invalid))).rejects.toThrow('Nội dung không hợp lệ.');
      expect(await product(service)).toEqual(original);
    },
  );

  it('rejects an invalid draft without inserting it and handles missing IDs explicitly', async () => {
    const service = new MockContentService();
    await expect(firstValueFrom(service.save(createContentDraft('products')))).rejects.toThrow();
    expect(await firstValueFrom(service.collectionCounts$)).toMatchObject({ products: 14 });
    expect(await firstValueFrom(service.duplicate('missing'))).toBeUndefined();
    expect(await firstValueFrom(service.setStatus(['missing'], 'archived'))).toEqual([]);
  });
});
