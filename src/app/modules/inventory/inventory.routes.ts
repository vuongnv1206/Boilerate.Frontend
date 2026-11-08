import { Routes } from '@angular/router';
import { inventoryGuard } from '@core/auth/permission.guard';

export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    canActivate: [inventoryGuard],
    title: 'Kho hàng · Boilerate',
    loadComponent: () =>
      import('./inventory-workspace/inventory-workspace.component').then(
        (m) => m.InventoryWorkspace,
      ),
  },
];
