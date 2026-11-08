import { Routes } from '@angular/router';
import { permissionGuard } from '@core/auth/permission.guard';
import { unsavedChangesGuard } from '@shared/guards/unsaved-changes.guard';

export const RENEWAL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./renewals/renewals-workspace.component').then((m) => m.RenewalsWorkspace),
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Renewal', actionCode: 'View' } },
        loadComponent: () =>
          import('./renewals/renewals-list/renewals.component').then((m) => m.Renewals),
      },
      {
        path: ':id',
        canActivate: [permissionGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { permission: { functionCode: 'Renewal', actionCode: 'View' } },
        loadComponent: () =>
          import('./renewals/renewal-detail/renewal-detail.component').then((m) => m.RenewalDetail),
      },
    ],
  },
];
