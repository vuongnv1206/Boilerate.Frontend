import { Routes } from '@angular/router';
import { permissionGuard } from '@core/auth/permission.guard';
import { unsavedChangesGuard } from '@shared/guards/unsaved-changes.guard';

/** Any URL no screen answers to, inside the shop or outside it. */
export const NOT_FOUND_ROUTES: Routes = [
  {
    path: '**',
    title: 'Không tìm thấy trang',
    loadComponent: () => import('./not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];

export const STOREFRONT_SHOP_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'products',
  },
  {
    path: 'products',
    title: 'Cửa hàng — Boilerate',
    loadComponent: () =>
      import('./catalog-list/catalog-list.component').then((m) => m.CatalogListComponent),
  },
  {
    path: 'products/:slug',
    title: 'Chi tiết sản phẩm — Boilerate',
    loadComponent: () =>
      import('./catalog-list/product-detail/product-detail.component').then(
        (m) => m.ProductDetailComponent,
      ),
  },
  {
    path: 'cart',
    title: 'Giỏ hàng — Boilerate',
    loadComponent: () => import('./cart-page/cart-page.component').then((m) => m.CartPageComponent),
  },
  {
    path: 'checkout',
    title: 'Thanh toán — Boilerate',
    loadComponent: () =>
      import('./cart-page/checkout-page/checkout-page.component').then(
        (m) => m.CheckoutPageComponent,
      ),
  },
  ...NOT_FOUND_ROUTES,
];

export const STOREFRONT_SETTINGS_ROUTES: Routes = [
  {
    path: '',
    title: 'Cài đặt cửa hàng — Quản trị',
    canActivate: [permissionGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permission: { functionCode: 'StorefrontSettings', actionCode: 'View' } },
    loadComponent: () =>
      import('./storefront-settings/storefront-settings.component').then(
        (m) => m.StorefrontSettingsComponent,
      ),
  },
];
