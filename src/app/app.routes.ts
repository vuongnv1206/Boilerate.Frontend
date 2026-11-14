import { Routes } from '@angular/router';
import { provideStorefrontCart } from '@api/storefront/services/cart.service';
import { provideWorkspaceNavigation } from './app.providers';
import { authGuard } from './core/auth/auth.guard';
import { adminHomeGuard } from './core/auth/permission.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./layout/auth-shell/auth-shell.component').then((m) => m.AuthShell),
    loadChildren: () =>
      import('./modules/identity/identity.routes').then((m) => m.AUTH_PUBLIC_ROUTES),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'admin',
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/auth-shell/auth-shell.component').then((m) => m.AuthShell),
    loadChildren: () =>
      import('./modules/identity/identity.routes').then((m) => m.AUTH_FLOW_ROUTES),
  },
  {
    path: 'shop',
    providers: [provideStorefrontCart()],
    loadComponent: () =>
      import('./layout/storefront-shell/storefront-shell.component').then((m) => m.StorefrontShell),
    children: [
      {
        path: 'orders',
        loadChildren: () =>
          import('./modules/ordering/ordering.routes').then((m) => m.CUSTOMER_ORDER_ROUTES),
      },
      {
        path: 'account',
        loadChildren: () =>
          import('./modules/personal/personal.routes').then((m) => m.PERSONAL_ROUTES),
      },
      {
        path: '',
        loadChildren: () =>
          import('./modules/storefront/storefront.routes').then((m) => m.STOREFRONT_SHOP_ROUTES),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    providers: [provideWorkspaceNavigation()],
    loadComponent: () =>
      import('./layout/admin-shell/admin-shell.component').then((m) => m.AdminShell),
    children: [
      {
        path: 'overview',
        loadChildren: () =>
          import('./modules/overview/overview.routes').then((m) => m.OVERVIEW_ROUTES),
      },
      {
        path: 'discounts',
        loadChildren: () =>
          import('./modules/ordering/ordering.routes').then((m) => m.DISCOUNT_ROUTES),
      },
      {
        path: 'storefront-settings',
        loadChildren: () =>
          import('./modules/storefront/storefront.routes').then(
            (m) => m.STOREFRONT_SETTINGS_ROUTES,
          ),
      },
      {
        path: 'inventory',
        loadChildren: () =>
          import('./modules/inventory/inventory.routes').then((m) => m.INVENTORY_ROUTES),
      },
      {
        path: 'outbox',
        loadChildren: () => import('./modules/outbox/outbox.routes').then((m) => m.OUTBOX_ROUTES),
      },
      {
        path: 'notifications',
        loadChildren: () =>
          import('./modules/notifications/notifications.routes').then(
            (m) => m.NOTIFICATIONS_ROUTES,
          ),
      },
      {
        path: 'account',
        loadChildren: () =>
          import('./modules/personal/personal.routes').then((m) => m.PERSONAL_ROUTES),
      },
      {
        path: '',
        pathMatch: 'full',
        canActivate: [adminHomeGuard],
        loadChildren: () =>
          import('./modules/identity/identity.routes').then((m) => m.ACCESS_DENIED_ROUTES),
      },
      {
        path: 'system',
        loadChildren: () =>
          import('./modules/identity/identity.routes').then((m) => m.SYSTEM_ROUTES),
      },
      {
        path: 'controls',
        loadChildren: () =>
          import('./modules/ui-gallery/ui-gallery.routes').then((m) => m.UI_GALLERY_ROUTES),
      },
      {
        path: 'collections',
        loadChildren: () =>
          import('./modules/catalog/catalog.routes').then((m) => m.CATALOG_ROUTES),
      },
      {
        path: 'renewals',
        loadChildren: () =>
          import('./modules/renewals/renewals.routes').then((m) => m.RENEWAL_ROUTES),
      },
      {
        path: '',
        loadChildren: () =>
          import('./modules/ordering/ordering.routes').then((m) => m.ADMIN_ORDER_ROUTES),
      },
      {
        path: 'forbidden',
        loadChildren: () =>
          import('./modules/identity/identity.routes').then((m) => m.ACCESS_DENIED_ROUTES),
      },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'admin' },
  {
    path: '**',
    loadChildren: () =>
      import('./modules/storefront/storefront.routes').then((m) => m.NOT_FOUND_ROUTES),
  },
];
