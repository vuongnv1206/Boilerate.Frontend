import { Routes } from '@angular/router';

export const CONTROL_GALLERY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/control-gallery/control-gallery').then((module) => module.ControlGallery),
    title: 'Bộ giao diện · Boilerate',
  },
];
