import { Injectable, computed, signal } from '@angular/core';
import {
  CollectionKey,
  ContentItem,
  ContentStatus,
  ListViewState,
  isValidItem,
  slugify,
} from './content-model';

const PRODUCTS: readonly [string, string, string, string, number, ContentStatus][] = [
  ['Túi Everyday Tote', 'bag', 'Phụ kiện', 'ACC-001', 690000, 'published'],
  ['Đèn bàn Studio', 'lamp', 'Không gian sống', 'LIV-002', 1290000, 'published'],
  ['Tai nghe Quiet Hours', 'headphones', 'Công nghệ', 'TEC-003', 2490000, 'draft'],
  ['Ghế Form Lounge', 'chair', 'Nội thất', 'FUR-004', 4590000, 'published'],
  ['Bình gốm Organic', 'vase', 'Không gian sống', 'LIV-005', 450000, 'published'],
  ['Máy ảnh Pocket Film', 'camera', 'Công nghệ', 'TEC-006', 3690000, 'draft'],
  ['Giày Daily Runner', 'shoe', 'Thời trang', 'FAS-007', 1590000, 'published'],
  ['Sổ tay Field Notes', 'notebook', 'Văn phòng phẩm', 'STA-008', 190000, 'published'],
  ['Túi Weekender Canvas', 'bag', 'Phụ kiện', 'ACC-009', 1190000, 'draft'],
  ['Đèn đọc sách Arc', 'lamp', 'Không gian sống', 'LIV-010', 890000, 'published'],
  ['Bình gốm Still', 'vase', 'Không gian sống', 'LIV-011', 590000, 'archived'],
  ['Ghế gỗ Sunday', 'chair', 'Nội thất', 'FUR-012', 3290000, 'draft'],
  ['Sổ tay Morning Pages', 'notebook', 'Văn phòng phẩm', 'STA-013', 250000, 'published'],
  ['Tai nghe Studio Pro', 'headphones', 'Công nghệ', 'TEC-014', 3290000, 'draft'],
];

function createSeed(): ContentItem[] {
  const products = PRODUCTS.map(
    ([name, image, category, sku, price, status], index): ContentItem => ({
      id: `product-${index + 1}`,
      collection: 'products',
      name,
      slug: slugify(name),
      description:
        'Thiết kế tinh giản, chất liệu được lựa chọn kỹ lưỡng. Một món đồ nhỏ cho nhịp sống có chủ đích và những khoảnh khắc thường ngày.',
      category,
      status,
      image: `/images/${image}.svg`,
      price,
      sku,
      stock: 12 + index * 7,
      featured: index < 2,
      seoTitle: name,
      seoDescription: 'Khám phá bộ sưu tập những thiết kế thiết yếu cho cuộc sống hiện đại.',
      updatedAt: new Date(2026, 9, 19, 14, 32 - index * 8).toISOString(),
    }),
  );
  const seedAt = (index: number): ContentItem => {
    const seed = products[index];
    if (!seed) throw new Error('Missing demo fixture.');
    return seed;
  };
  const categories = [
    'Phụ kiện',
    'Không gian sống',
    'Công nghệ',
    'Nội thất',
    'Thời trang',
    'Văn phòng phẩm',
  ].map((name, index): ContentItem => ({
    ...seedAt(index),
    id: `category-${index + 1}`,
    collection: 'categories',
    name,
    slug: slugify(name),
    status: 'published',
    description: `Những thiết kế nổi bật thuộc danh mục ${name.toLowerCase()}.`,
  }));
  const types = ['Sản phẩm vật lý', 'Sản phẩm số', 'Bộ sưu tập'].map(
    (name, index): ContentItem => ({
      ...seedAt(index),
      id: `type-${index + 1}`,
      collection: 'types',
      name,
      slug: slugify(name),
      status: 'published',
      description: 'Cấu trúc nội dung mẫu cho cửa hàng.',
    }),
  );
  return [...products, ...categories, ...types];
}

@Injectable({ providedIn: 'root' })
export class DemoContentStore {
  private readonly listViews = new Map<CollectionKey, ListViewState>();
  private readonly records = signal<ContentItem[]>(createSeed());
  readonly items = this.records.asReadonly();
  readonly productCount = computed(
    () => this.records().filter((item) => item.collection === 'products').length,
  );

  getListView(key: CollectionKey): ListViewState {
    const state: ListViewState = this.listViews.get(key) ?? {
      query: '',
      status: 'all',
      page: 1,
      pageSize: 10,
      columns: ['status', 'category', 'price', 'updated'],
    };
    return { ...state, columns: [...state.columns] };
  }

  setListView(key: CollectionKey, state: ListViewState): void {
    this.listViews.set(key, { ...state, columns: [...state.columns] });
  }

  collection(key: CollectionKey): ContentItem[] {
    return this.records().filter((item) => item.collection === key);
  }

  get(id: string): ContentItem | undefined {
    const item = this.records().find((record) => record.id === id);
    return item ? { ...item } : undefined;
  }

  draft(collection: CollectionKey): ContentItem {
    return {
      id: `demo-${crypto.randomUUID()}`,
      collection,
      name: '',
      slug: '',
      description: '',
      category: 'Phụ kiện',
      status: 'draft',
      image: '/images/bag.svg',
      price: 0,
      sku: '',
      stock: 0,
      featured: false,
      seoTitle: '',
      seoDescription: '',
      updatedAt: new Date().toISOString(),
    };
  }

  save(item: ContentItem): ContentItem {
    if (!isValidItem(item)) throw new Error('Nội dung không hợp lệ.');
    const saved = { ...item, name: item.name.trim(), updatedAt: new Date().toISOString() };
    this.records.update((records) =>
      records.some((record) => record.id === saved.id)
        ? records.map((record) => (record.id === saved.id ? saved : record))
        : [saved, ...records],
    );
    return { ...saved };
  }

  duplicate(id: string): ContentItem | undefined {
    const original = this.get(id);
    if (!original) return undefined;
    const copy = {
      ...original,
      id: `demo-${crypto.randomUUID()}`,
      name: `${original.name} (bản sao)`,
      slug: `${original.slug}-copy-${this.records().length}`,
      status: 'draft' as const,
    };
    return this.save(copy);
  }

  setStatus(ids: ReadonlySet<string>, status: ContentStatus): void {
    this.records.update((records) =>
      records.map((record) =>
        ids.has(record.id) ? { ...record, status, updatedAt: new Date().toISOString() } : record,
      ),
    );
  }

  remove(ids: ReadonlySet<string>): void {
    this.records.update((records) => records.filter((record) => !ids.has(record.id)));
  }
}
