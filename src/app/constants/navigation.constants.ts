import { WorkspaceCollectionLink } from '@models/navigation.model';
import { CATALOG_PERMISSIONS } from './permission.constants';

export const COLLECTION_LINKS = [
  {
    key: 'products',
    label: 'Sản phẩm',
    icon: 'box',
    path: '/admin/collections/products',
    permission: CATALOG_PERMISSIONS.product.view,
  },
  {
    key: 'categories',
    label: 'Danh mục',
    icon: 'folder',
    path: '/admin/collections/categories',
    permission: CATALOG_PERMISSIONS.category.view,
  },
  {
    key: 'product-types',
    label: 'Loại sản phẩm',
    icon: 'sliders',
    path: '/admin/collections/product-types',
    permission: CATALOG_PERMISSIONS.productType.view,
  },
] as const satisfies readonly (WorkspaceCollectionLink & { readonly permission: string })[];
