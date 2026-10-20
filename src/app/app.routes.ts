import { Routes } from '@angular/router';
import { provideWorkspaceNavigation } from './app.providers';

export const routes: Routes = [
  {
    path: 'admin',
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
        path: '',
        loadChildren: () =>
          import('./features/content/content.routes').then((module) => module.CONTENT_ROUTES),
      },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'admin/collections/products' },
  { path: '**', redirectTo: 'admin/collections/products' },
];
