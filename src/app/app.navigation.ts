import { WorkspaceCollectionLink } from './core/navigation/workspace-navigation';

export const COLLECTION_LINKS: readonly WorkspaceCollectionLink[] = [
  { key: 'products', label: 'Sản phẩm', icon: 'box', path: '/admin/collections/products' },
  { key: 'categories', label: 'Danh mục', icon: 'folder', path: '/admin/collections/categories' },
  {
    key: 'product-types',
    label: 'Loại sản phẩm',
    icon: 'sliders',
    path: '/admin/collections/product-types',
  },
];
