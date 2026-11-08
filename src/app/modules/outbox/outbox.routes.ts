import { Routes } from '@angular/router';
import { permissionGuard } from '@core/auth/permission.guard';

export const OUTBOX_ROUTES: Routes = [
  {
    path: '',
    data: { permission: { functionCode: 'Outbox', actionCode: 'View' } },
    canActivate: [permissionGuard],
    loadComponent: () =>
      import('./outbox-list/outbox-list.component').then((m) => m.OutboxListComponent),
  },
];
