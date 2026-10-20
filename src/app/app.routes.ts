import { Routes } from '@angular/router';
import { provideWorkspaceNavigation } from './app.providers';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    providers: [provideWorkspaceNavigation()],
    loadComponent: () => import('./layout/admin-shell/admin-shell').then((m) => m.AdminShell),
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
      { path: '', pathMatch: 'full', redirectTo: 'collections/products' },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'admin/collections/products' },
  { path: '**', redirectTo: 'admin/collections/products' },
];
