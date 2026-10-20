import { Routes } from '@angular/router';
import { itemEditorGuard } from './features/content-workspace/item-editor/item-editor.guard';

export const routes: Routes = [
  {
    path: 'admin',
    loadComponent: () => import('./layout/admin-shell/admin-shell').then((m) => m.AdminShell),
    children: [
      {
        path: 'collections/:collection',
        loadComponent: () =>
          import('./features/content-workspace/collection-list/collection-list').then(
            (m) => m.CollectionList,
          ),
        title: 'Bộ sưu tập · Boilerate',
      },
      {
        path: 'items/:id',
        canDeactivate: [itemEditorGuard],
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadComponent: () =>
          import('./features/content-workspace/item-editor/item-editor').then((m) => m.ItemEditor),
        title: 'Chỉnh sửa nội dung · Boilerate',
      },
      { path: '', pathMatch: 'full', redirectTo: 'collections/products' },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'admin/collections/products' },
  { path: '**', redirectTo: 'admin/collections/products' },
];
