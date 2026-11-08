import { Routes } from '@angular/router';
import { permissionGuard } from '@core/auth/permission.guard';
import { unsavedChangesGuard } from '@shared/guards/unsaved-changes.guard';

export const ADMIN_ORDER_ROUTES: Routes = [
  {
    path: 'orders',
    loadComponent: () =>
      import('./orders/orders-workspace.component').then((m) => m.OrdersWorkspace),
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Order', actionCode: 'View' } },
        loadComponent: () => import('./orders/orders-list/orders.component').then((m) => m.Orders),
      },
      {
        path: ':id',
        canDeactivate: [unsavedChangesGuard],
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Order', actionCode: 'View' } },
        loadComponent: () =>
          import('./orders/order-detail/order-detail.component').then((m) => m.OrderDetail),
      },
    ],
  },
];

export const DISCOUNT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: { functionCode: 'Discount', actionCode: 'View' } },
    loadComponent: () => import('./discounts/discounts.component').then((m) => m.Discounts),
  },
  {
    path: 'new',
    canActivate: [permissionGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permission: { functionCode: 'Discount', actionCode: 'Create' } },
    loadComponent: () =>
      import('./discounts/discount-detail/discount-io.component').then((m) => m.DiscountIo),
  },
  {
    path: ':id',
    canActivate: [permissionGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permission: { functionCode: 'Discount', actionCode: 'View' } },
    loadComponent: () =>
      import('./discounts/discount-detail/discount-io.component').then((m) => m.DiscountIo),
  },
];

export const CUSTOMER_ORDER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./my-orders/my-orders.component').then((m) => m.MyOrdersComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./my-orders/customer-order-detail/customer-order-detail.component').then(
        (m) => m.CustomerOrderDetailComponent,
      ),
  },
];
