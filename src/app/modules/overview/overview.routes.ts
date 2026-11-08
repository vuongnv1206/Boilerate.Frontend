import { Routes } from '@angular/router';
import { overviewGuard } from '@core/auth/permission.guard';

export const OVERVIEW_ROUTES: Routes = [
  {
    path: '',
    canActivate: [overviewGuard],
    loadComponent: () =>
      import('./overview/overview.component').then((module) => module.OverviewComponent),
  },
];
