import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthSession } from './auth-session';
import {
  COLLECTION_LINKS,
  INVENTORY_PERMISSION,
  OVERVIEW_PERMISSION,
  SYSTEM_LINKS,
} from '../navigation/navigation.constants';
import { hasNavigationPermission } from '../navigation/navigation-permission';

export const permissionGuard: CanActivateFn = (route) => {
  const session = inject(AuthSession);
  const router = inject(Router);
  return hasNavigationPermission(session, route.data['permission'])
    ? true
    : router.createUrlTree(['/admin/forbidden']);
};

export const overviewGuard: CanActivateFn = () =>
  hasNavigationPermission(inject(AuthSession), OVERVIEW_PERMISSION)
    ? true
    : inject(Router).createUrlTree(['/admin/forbidden']);

export const inventoryGuard: CanActivateFn = () =>
  hasNavigationPermission(inject(AuthSession), INVENTORY_PERMISSION)
    ? true
    : inject(Router).createUrlTree(['/admin/forbidden']);

export const adminHomeGuard: CanActivateFn = () => {
  const session = inject(AuthSession);
  const router = inject(Router);
  return session
    .restore()
    .pipe(
      map((signedIn) =>
        router.createUrlTree([
          signedIn
            ? ([...COLLECTION_LINKS, ...(session.isCentralAdmin() ? SYSTEM_LINKS : [])].find(
                (link) => hasNavigationPermission(session, link.permission),
              )?.path ?? '/admin/forbidden')
            : '/login',
        ]),
      ),
    );
};

export const centralAdminGuard: CanActivateFn = () =>
  inject(AuthSession).isCentralAdmin() ? true : inject(Router).createUrlTree(['/admin/forbidden']);
