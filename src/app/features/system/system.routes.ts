import { Routes } from '@angular/router';
import { centralAdminGuard, permissionGuard } from '@guards/permission.guard';
import { unsavedChangesGuard } from '@guards/unsaved-changes.guard';
import { SystemAdministrationService } from '@services/system-administration.service';
import { SYSTEM_SECTIONS } from '@constants/system.constants';
import { SystemKind } from '@models/system.model';

const lists: Routes = (['roles', 'users', 'functions', 'actions'] as const).flatMap(
  (kind: SystemKind) => {
    const permission = { functionCode: SYSTEM_SECTIONS[kind].functionCode, actionCode: 'View' };
    const editor =
      kind === 'roles'
        ? () => import('./roles/role-io/role-io.component').then((m) => m.RoleIo)
        : kind === 'users'
          ? () => import('./users/user-io/user-io.component').then((m) => m.UserIo)
          : () =>
              import('./capabilities/capability-io/capability-io.component').then(
                (m) => m.CapabilityIo,
              );
    return [
      {
        path: kind,
        pathMatch: 'full' as const,
        data: { kind, permission },
        canActivate: [centralAdminGuard, permissionGuard],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./system-list/system-list.component').then((m) => m.SystemList),
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
    providers: [SystemAdministrationService],
    children: lists,
  },
];
