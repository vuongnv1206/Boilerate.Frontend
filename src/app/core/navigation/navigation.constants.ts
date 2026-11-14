import { ProtectedNavigationLink } from './navigation.model';

export const OVERVIEW_PERMISSION = {
  anyOf: ['Order', 'Renewal', 'Inventory', 'DigitalInventory', 'FinancialSummary'].map(
    (functionCode) => ({ functionCode, actionCode: 'View' }),
  ),
} as const;

export const INVENTORY_PERMISSION = {
  anyOf: [
    { functionCode: 'Inventory', actionCode: 'View' },
    { functionCode: 'DigitalInventory', actionCode: 'View' },
  ],
} as const;

export const COLLECTION_LINKS = [
  {
    key: 'overview',
    label: 'Tổng quan',
    icon: 'layers',
    path: '/admin/overview',
    permission: OVERVIEW_PERMISSION,
  },
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
    key: 'inventory',
    label: 'Kho hàng',
    icon: 'database',
    path: '/admin/inventory',
    permission: INVENTORY_PERMISSION,
  },
  {
    key: 'orders',
    label: 'Đơn hàng',
    icon: 'shopping-bag',
    path: '/admin/orders',
    permission: { functionCode: 'Order', actionCode: 'View' },
  },
  {
    key: 'discounts',
    label: 'Mã giảm giá',
    icon: 'tag',
    path: '/admin/discounts',
    permission: { functionCode: 'Discount', actionCode: 'View' },
  },
  {
    key: 'storefront-settings',
    label: 'Thanh toán cửa hàng',
    icon: 'settings',
    path: '/admin/storefront-settings',
    permission: { functionCode: 'StorefrontSettings', actionCode: 'View' },
  },
  {
    key: 'renewals',
    label: 'Gia hạn thủ công',
    icon: 'refresh',
    path: '/admin/renewals',
    permission: { functionCode: 'Renewal', actionCode: 'View' },
  },
  {
    key: 'outbox',
    label: 'Hàng đợi Outbox',
    icon: 'inbox',
    path: '/admin/outbox',
    permission: { functionCode: 'Outbox', actionCode: 'View' },
  },
] as const satisfies readonly ProtectedNavigationLink[];

export const SYSTEM_LINKS: readonly ProtectedNavigationLink[] = [
  {
    key: 'roles',
    label: 'Vai trò và phân quyền',
    icon: 'shield-check',
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
