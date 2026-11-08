import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth.guard';
import { unsavedChangesGuard } from '@shared/guards/unsaved-changes.guard';

export const PERSONAL_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./account/account.component').then((m) => m.AccountComponent),
  },
];
