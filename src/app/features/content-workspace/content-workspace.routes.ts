import { Routes } from '@angular/router';
import { itemEditorGuard } from './item-editor/item-editor.guard';

export const CONTENT_WORKSPACE_ROUTES: Routes = [
  {
    path: 'collections/:collection',
    loadComponent: () =>
      import('./collection-list/collection-list').then((module) => module.CollectionList),
    title: 'Bộ sưu tập · Boilerate',
  },
  {
    path: 'items/:id',
    canDeactivate: [itemEditorGuard],
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    loadComponent: () => import('./item-editor/item-editor').then((module) => module.ItemEditor),
    title: 'Chỉnh sửa nội dung · Boilerate',
  },
  { path: '', pathMatch: 'full', redirectTo: 'collections/products' },
];
