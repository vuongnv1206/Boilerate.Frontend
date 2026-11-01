import { Routes } from '@angular/router';
import { permissionGuard } from '@guards/permission.guard';
import { unsavedChangesGuard } from '@guards/unsaved-changes.guard';

export const DISCOUNT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: { functionCode: 'Discount', actionCode: 'View' } },
    loadComponent: () => import('./discounts.component').then((m) => m.Discounts),
  },
  {
    path: 'new',
    canActivate: [permissionGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permission: { functionCode: 'Discount', actionCode: 'Create' } },
    loadComponent: () => import('./discount-io/discount-io.component').then((m) => m.DiscountIo),
  },
  {
    path: ':id',
    canActivate: [permissionGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permission: { functionCode: 'Discount', actionCode: 'View' } },
    loadComponent: () => import('./discount-io/discount-io.component').then((m) => m.DiscountIo),
  },
];
