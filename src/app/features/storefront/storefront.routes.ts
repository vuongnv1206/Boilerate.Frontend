import { Routes } from '@angular/router';

export const STOREFRONT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/storefront-shell.component').then((m) => m.StorefrontShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'products',
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./catalog/catalog-list.component').then((m) => m.CatalogListComponent),
      },
      {
        path: 'products/:slug',
        loadComponent: () =>
          import('./catalog/product-detail/product-detail.component').then(
            (m) => m.ProductDetailComponent,
          ),
      },
      {
        path: 'cart',
        loadComponent: () => import('./cart/cart-page.component').then((m) => m.CartPageComponent),
      },
      {
        path: 'checkout',
        loadComponent: () =>
          import('./checkout/checkout-page.component').then((m) => m.CheckoutPageComponent),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./customer-orders/my-orders.component').then((m) => m.MyOrdersComponent),
      },
      {
        path: 'orders/:id',
        loadComponent: () =>
          import('./customer-orders/customer-order-detail.component').then(
            (m) => m.CustomerOrderDetailComponent,
          ),
      },
    ],
  },
];
