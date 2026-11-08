import { Routes } from '@angular/router';

export const UI_GALLERY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./control-gallery/control-gallery.component').then((m) => m.ControlGallery),
    title: 'Bộ giao diện · Boilerate',
  },
];
