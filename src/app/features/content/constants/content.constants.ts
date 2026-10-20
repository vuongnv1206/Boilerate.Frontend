import { CollectionKey, ContentStatus } from '../enums/content.enum';
import type { CollectionDefinition } from '../models/content-item';

export const CONTENT_LIMITS = {
  name: 180,
  description: 2000,
  sku: 64,
  seoTitle: 70,
  seoDescription: 160,
} as const;

export const CONTENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CONTENT_DEFAULTS = {
  category: 'Phụ kiện',
  image: '/images/bag.svg',
} as const;

export const CONTENT_COPY_SUFFIX = ' (bản sao)';

export const DEFAULT_CONTENT_COLLECTION = {
  key: CollectionKey.Products,
  label: 'Sản phẩm',
  singular: 'sản phẩm',
  icon: 'box',
  description: 'Quản lý và sắp xếp nội dung sản phẩm của cửa hàng.',
} as const satisfies CollectionDefinition;

export const COLLECTIONS = [
  DEFAULT_CONTENT_COLLECTION,
  {
    key: CollectionKey.Categories,
    label: 'Danh mục',
    singular: 'danh mục',
    icon: 'tag',
    description: 'Nhóm nội dung thành các danh mục dễ khám phá.',
  },
  {
    key: CollectionKey.Types,
    label: 'Loại sản phẩm',
    singular: 'loại sản phẩm',
    icon: 'layers',
    description: 'Các loại nội dung và cấu trúc của bộ sưu tập.',
  },
] as const satisfies readonly CollectionDefinition[];

export const STATUS_LABELS = {
  [ContentStatus.Draft]: 'Bản nháp',
  [ContentStatus.Published]: 'Đã xuất bản',
  [ContentStatus.Archived]: 'Đã lưu trữ',
} as const satisfies Readonly<Record<ContentStatus, string>>;
