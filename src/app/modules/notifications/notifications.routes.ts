import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth.guard';

export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./notifications-list/notifications-list.component').then(
        (m) => m.NotificationsListComponent,
      ),
  },
];
