import { Routes } from '@angular/router';
import { provideWorkspaceNavigation } from './app.providers';
import { authGuard } from './core/auth/auth.guard';
import { adminHomeGuard } from '@guards/permission.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    providers: [provideWorkspaceNavigation()],
    loadComponent: () =>
      import('./layout/admin-shell/admin-shell.component').then((m) => m.AdminShell),
    children: [
      {
        path: 'controls',
        loadChildren: () =>
          import('./features/control-gallery/control-gallery.routes').then(
            (module) => module.CONTROL_GALLERY_ROUTES,
          ),
      },
      {
        path: 'collections',
        loadChildren: () =>
          import('./features/collections/collections.routes').then(
            (module) => module.COLLECTIONS_ROUTES,
          ),
      },
      {
        path: '',
        loadChildren: () => import('./features/orders/orders.routes').then((m) => m.ORDER_ROUTES),
      },
      {
        path: 'forbidden',
        loadChildren: () =>
          import('./features/access-denied/access-denied.routes').then(
            (m) => m.ACCESS_DENIED_ROUTES,
          ),
      },
      {
        path: '',
        pathMatch: 'full',
        canActivate: [adminHomeGuard],
        loadChildren: () =>
          import('./features/access-denied/access-denied.routes').then(
            (m) => m.ACCESS_DENIED_ROUTES,
          ),
      },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'admin' },
  { path: '**', redirectTo: 'admin' },
];
