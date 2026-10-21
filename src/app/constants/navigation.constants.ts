import { ProtectedNavigationLink } from '@models/navigation.model';

export const COLLECTION_LINKS = [
  {
    key: 'products',
    label: 'Sản phẩm',
    icon: 'box',
    path: '/admin/collections/products',
    permission: { functionCode: 'Product', actionCode: 'View' },
  },
  {
    key: 'categories',
    label: 'Danh mục',
    icon: 'folder',
    path: '/admin/collections/categories',
    permission: { functionCode: 'Category', actionCode: 'View' },
  },
  {
    key: 'product-types',
    label: 'Loại sản phẩm',
    icon: 'sliders',
    path: '/admin/collections/product-types',
    permission: { functionCode: 'ProductType', actionCode: 'View' },
  },
  {
    key: 'orders',
    label: 'Đơn hàng',
    icon: 'shopping-bag',
    path: '/admin/orders',
    permission: { functionCode: 'Order', actionCode: 'View' },
  },
  {
    key: 'renewals',
    label: 'Gia hạn thủ công',
    icon: 'settings',
    path: '/admin/renewals',
    permission: { functionCode: 'Renewal', actionCode: 'View' },
  },
] as const satisfies readonly ProtectedNavigationLink[];

export const SYSTEM_LINKS: readonly ProtectedNavigationLink[] = [
  {
    key: 'roles',
    label: 'Vai trò và phân quyền',
    icon: 'settings',
    path: '/admin/system/roles',
    permission: { functionCode: 'Role', actionCode: 'View' },
    centralAdmin: true,
  },
  {
    key: 'users',
    label: 'Người dùng',
    icon: 'user',
    path: '/admin/system/users',
    permission: { functionCode: 'User', actionCode: 'View' },
    centralAdmin: true,
  },
  {
    key: 'functions',
    label: 'Chức năng',
    icon: 'layers',
    path: '/admin/system/functions',
    permission: { functionCode: 'Function', actionCode: 'View' },
    centralAdmin: true,
  },
  {
    key: 'actions',
    label: 'Hành động',
    icon: 'sliders',
    path: '/admin/system/actions',
    permission: { functionCode: 'Action', actionCode: 'View' },
    centralAdmin: true,
  },
];
