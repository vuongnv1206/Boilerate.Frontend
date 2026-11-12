import { Routes } from '@angular/router';
import { permissionGuard } from '@core/auth/permission.guard';
import { OVERVIEW_PERMISSION } from '@core/navigation/navigation.constants';

export const OVERVIEW_ROUTES: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: OVERVIEW_PERMISSION },
    loadComponent: () =>
      import('./overview/overview.component').then((module) => module.OverviewComponent),
  },
];
