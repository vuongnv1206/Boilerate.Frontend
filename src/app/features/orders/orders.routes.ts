import { Routes } from '@angular/router';
import { permissionGuard } from '@guards/permission.guard';
import { ORDER_PERMISSIONS } from '@constants/order.constants';
import { OrdersService } from '@services/orders.service';

export const ORDER_ROUTES: Routes = [
  {
    path: 'orders',
    providers: [OrdersService],
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [permissionGuard],
        data: { permission: ORDER_PERMISSIONS.view },
        loadComponent: () => import('./orders.component').then((m) => m.Orders),
      },
      {
        path: ':id',
        canActivate: [permissionGuard],
        data: { permission: ORDER_PERMISSIONS.view },
        loadComponent: () => import('./order-detail.component').then((m) => m.OrderDetail),
      },
    ],
  },
];
