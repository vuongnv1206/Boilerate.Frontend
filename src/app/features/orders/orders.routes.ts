import { Routes } from '@angular/router';
import { permissionGuard } from '@guards/permission.guard';
import { OrdersService } from '@services/orders.service';
import { unsavedChangesGuard } from '@guards/unsaved-changes.guard';

export const ORDER_ROUTES: Routes = [
  {
    path: 'orders',
    providers: [OrdersService],
    loadComponent: () => import('./orders-workspace.component').then((m) => m.OrdersWorkspace),
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Order', actionCode: 'View' } },
        loadComponent: () => import('./orders.component').then((m) => m.Orders),
      },
      {
        path: ':id',
        canDeactivate: [unsavedChangesGuard],
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Order', actionCode: 'View' } },
        loadComponent: () => import('./order-detail.component').then((m) => m.OrderDetail),
      },
    ],
  },
];
