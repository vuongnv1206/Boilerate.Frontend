import { Routes } from '@angular/router';
import { contentIoGuard } from './guards/content-io.guard';

export const CONTENT_ROUTES: Routes = [
  {
    path: 'collections/:collection',
    loadComponent: () => import('./pages/content/content').then((module) => module.Content),
    title: 'Bộ sưu tập · Boilerate',
  },
  {
    path: 'items/:id',
    canDeactivate: [contentIoGuard],
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    loadComponent: () => import('./pages/content-io/content-io').then((module) => module.ContentIo),
    title: 'Chỉnh sửa nội dung · Boilerate',
  },
  { path: '', pathMatch: 'full', redirectTo: 'collections/products' },
];
