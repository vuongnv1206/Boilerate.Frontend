import { Routes } from '@angular/router';

export const ACCESS_DENIED_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./access-denied.component').then((module) => module.AccessDenied),
  },
];
