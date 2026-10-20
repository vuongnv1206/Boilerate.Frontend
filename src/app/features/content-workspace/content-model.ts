export type CollectionKey = 'products' | 'categories' | 'types';
export type ContentStatus = 'draft' | 'published' | 'archived';

export interface ContentItem {
  id: string;
  collection: CollectionKey;
  name: string;
  slug: string;
  description: string;
  category: string;
  status: ContentStatus;
  image: string;
  price: number;
  sku: string;
  stock: number;
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  updatedAt: string;
}

export interface CollectionDefinition {
  key: CollectionKey;
  label: string;
  singular: string;
  icon: string;
  description: string;
}

export interface ListViewState {
  query: string;
  status: ContentStatus | 'all';
  page: number;
  pageSize: number;
  columns: string[];
}

const PRODUCT_COLLECTION: CollectionDefinition = {
  key: 'products',
  label: 'Sản phẩm',
  singular: 'sản phẩm',
  icon: 'box',
  description: 'Quản lý và sắp xếp nội dung sản phẩm của cửa hàng.',
};

export const COLLECTIONS: readonly CollectionDefinition[] = [
  PRODUCT_COLLECTION,
  {
    key: 'categories',
    label: 'Danh mục',
    singular: 'danh mục',
    icon: 'tag',
    description: 'Nhóm nội dung thành các danh mục dễ khám phá.',
  },
  {
    key: 'types',
    label: 'Loại sản phẩm',
    singular: 'loại sản phẩm',
    icon: 'layers',
    description: 'Các loại nội dung và cấu trúc của bộ sưu tập.',
  },
];

export const STATUS_LABELS: Record<ContentStatus, string> = {
  draft: 'Bản nháp',
  published: 'Đã xuất bản',
  archived: 'Đã lưu trữ',
};

export function collectionDefinition(value: string | null): CollectionDefinition {
  return COLLECTIONS.find((collection) => collection.key === value) ?? PRODUCT_COLLECTION;
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function filterItems(
  items: readonly ContentItem[],
  query: string,
  status: ContentStatus | 'all',
): ContentItem[] {
  const normalizedQuery = slugify(query).replace(/-/g, ' ');
  return items.filter(
    (item) =>
      (status === 'all' || item.status === status) &&
      slugify(`${item.name} ${item.sku} ${item.category}`)
        .replace(/-/g, ' ')
        .includes(normalizedQuery),
  );
}

export function isValidItem(item: ContentItem): boolean {
  return (
    item.name.trim().length > 0 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) &&
    Number.isFinite(item.price) &&
    item.price >= 0 &&
    Number.isInteger(item.stock) &&
    item.stock >= 0
  );
}
