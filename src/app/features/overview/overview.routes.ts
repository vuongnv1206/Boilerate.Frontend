import { Routes } from '@angular/router';
import { overviewGuard } from '@guards/permission.guard';

export const OVERVIEW_ROUTES: Routes = [
  {
    path: '',
    canActivate: [overviewGuard],
    loadComponent: () => import('./overview.component').then((module) => module.Overview),
  },
];
