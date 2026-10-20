import {
  COLLECTIONS,
  CONTENT_DEFAULTS,
  CONTENT_LIMITS,
  CONTENT_SLUG_PATTERN,
  DEFAULT_CONTENT_COLLECTION,
} from '../constants/content.constants';
import { CollectionKey, ContentStatus } from '../enums/content.enum';
import { ContentColumn } from '../enums/content-table.enum';
import type { ContentStatusFilter } from './content-view.model';

/** Workspace demonstration model; this is not a Catalog API DTO. */
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
  status: ContentStatusFilter;
  page: number;
  pageSize: number;
  columns: ContentColumn[];
}

export function collectionDefinition(value: string | null): CollectionDefinition {
  return COLLECTIONS.find((collection) => collection.key === value) ?? DEFAULT_CONTENT_COLLECTION;
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
  status: ContentStatusFilter,
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
    item.name.length <= CONTENT_LIMITS.name &&
    CONTENT_SLUG_PATTERN.test(item.slug) &&
    item.description.length <= CONTENT_LIMITS.description &&
    item.sku.length <= CONTENT_LIMITS.sku &&
    item.seoTitle.length <= CONTENT_LIMITS.seoTitle &&
    item.seoDescription.length <= CONTENT_LIMITS.seoDescription &&
    Number.isFinite(item.price) &&
    item.price >= 0 &&
    Number.isInteger(item.stock) &&
    item.stock >= 0
  );
}

export function createContentDraft(collection: CollectionKey): ContentItem {
  return {
    id: `demo-${crypto.randomUUID()}`,
    collection,
    name: '',
    slug: '',
    description: '',
    category: CONTENT_DEFAULTS.category,
    status: ContentStatus.Draft,
    image: CONTENT_DEFAULTS.image,
    price: 0,
    sku: '',
    stock: 0,
    featured: false,
    seoTitle: '',
    seoDescription: '',
    updatedAt: new Date().toISOString(),
  };
}
