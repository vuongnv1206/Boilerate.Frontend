import { Routes } from '@angular/router';
import { permissionGuard } from '@core/auth/permission.guard';
import { INVENTORY_PERMISSION } from '@core/navigation/navigation.constants';

export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: INVENTORY_PERMISSION },
    title: 'Kho hàng · Boilerate',
    loadComponent: () =>
      import('./inventory-workspace/inventory-workspace.component').then(
        (m) => m.InventoryWorkspace,
      ),
  },
];
