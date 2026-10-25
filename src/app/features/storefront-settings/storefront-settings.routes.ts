import { Routes } from '@angular/router';
import { permissionGuard } from '@guards/permission.guard';

export const STOREFRONT_SETTINGS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: { functionCode: 'StorefrontSettings', actionCode: 'View' } },
    loadComponent: () =>
      import('./storefront-settings.component').then((m) => m.StorefrontSettingsComponent),
  },
];
