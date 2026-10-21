import { Routes } from '@angular/router';
import { permissionGuard } from '@guards/permission.guard';
import { unsavedChangesGuard } from '@guards/unsaved-changes.guard';
import { RenewalsService } from '@services/renewals.service';
import { RenewalsStore } from '@stores/renewals.store';

export const RENEWAL_ROUTES: Routes = [
  {
    path: '',
    providers: [RenewalsService, RenewalsStore],
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [permissionGuard],
        data: { permission: { functionCode: 'Renewal', actionCode: 'View' } },
        loadComponent: () => import('./renewals.component').then((module) => module.Renewals),
      },
      {
        path: ':id',
        canActivate: [permissionGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { permission: { functionCode: 'Renewal', actionCode: 'View' } },
        loadComponent: () =>
          import('./renewal-detail.component').then((module) => module.RenewalDetail),
      },
    ],
  },
];
