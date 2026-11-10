import { Routes } from '@angular/router';
import { centralAdminGuard, permissionGuard } from '@core/auth/permission.guard';
import { unsavedChangesGuard } from '@shared/guards/unsaved-changes.guard';
import { SYSTEM_SECTIONS, SystemKind } from '@api/identity/models/identity.dto';

/** Public auth screens rendered inside the AuthShell (login, registration, confirmation, password reset). */
export const AUTH_PUBLIC_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./auth/login/login.component').then((m) => m.LoginComponent),
  },
];

export const AUTH_FLOW_ROUTES: Routes = [
  {
    path: 'register',
    loadComponent: () =>
      import('./auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'confirm-email',
    loadComponent: () =>
      import('./auth/confirm-email/confirm-email.component').then((m) => m.ConfirmEmailComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
];

export const ACCESS_DENIED_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./auth/access-denied/access-denied.component').then((m) => m.AccessDeniedComponent),
  },
];

const lists: Routes = (['roles', 'users', 'functions', 'actions'] as const).flatMap(
  (kind: SystemKind) => {
    const permission = { functionCode: SYSTEM_SECTIONS[kind].functionCode, actionCode: 'View' };
    const editor =
      kind === 'roles'
        ? () => import('./system/role-detail/role-io.component').then((m) => m.RoleIo)
        : kind === 'users'
          ? () => import('./system/user-detail/user-io.component').then((m) => m.UserIo)
          : () =>
              import('./system/capability-detail/capability-io.component').then(
                (m) => m.CapabilityIo,
              );
    return [
      {
        path: kind,
        pathMatch: 'full' as const,
        data: { kind, permission },
        canActivate: [centralAdminGuard, permissionGuard],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./system/system-list.component').then((m) => m.SystemList),
      },
      {
        path: `${kind}/new`,
        data: { kind, permission: { ...permission, actionCode: 'Create' } },
        canActivate: [centralAdminGuard, permissionGuard],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: editor,
      },
      {
        path: `${kind}/:id`,
        data: { kind, permission },
        canActivate: [centralAdminGuard, permissionGuard],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: editor,
      },
    ];
  },
);

export const SYSTEM_ROUTES: Routes = [
  {
    path: '',
    canActivate: [centralAdminGuard],
    children: [
      ...lists,
      {
        path: 'function-groups',
        pathMatch: 'full',
        redirectTo: 'functions',
      },
    ],
  },
];
