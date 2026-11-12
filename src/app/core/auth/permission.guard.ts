import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthSession } from './auth-session';
import { COLLECTION_LINKS, SYSTEM_LINKS } from '../navigation/navigation.constants';
import { hasNavigationPermission } from '../navigation/navigation-permission';

/** Reads the required permission from the route's `data.permission`. */
export const permissionGuard: CanActivateFn = (route) =>
  hasNavigationPermission(inject(AuthSession), route.data['permission'])
    ? true
    : inject(Router).createUrlTree(['/admin/forbidden']);

export const centralAdminGuard: CanActivateFn = () =>
  inject(AuthSession).isCentralAdmin() ? true : inject(Router).createUrlTree(['/admin/forbidden']);

/** `/admin` itself: go to the first screen this user may open. */
export const adminHomeGuard: CanActivateFn = () => {
  const session = inject(AuthSession);
  const router = inject(Router);
  return session.restore().pipe(
    map((signedIn) => {
      if (!signedIn) return router.createUrlTree(['/login']);
      const links = [...COLLECTION_LINKS, ...(session.isCentralAdmin() ? SYSTEM_LINKS : [])];
      const first = links.find((link) => hasNavigationPermission(session, link.permission));
      return router.createUrlTree([first?.path ?? '/admin/forbidden']);
    }),
  );
};
