import { Routes } from '@angular/router';

export const CONTROL_GALLERY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./control-gallery').then((module) => module.ControlGallery),
    title: 'Bộ giao diện · Boilerate',
  },
];
