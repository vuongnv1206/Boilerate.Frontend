import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { COLLECTION_LINKS, SYSTEM_LINKS } from '@constants/navigation.constants';

export const permissionGuard: CanActivateFn = (route) => {
  const session = inject(AuthSession);
  const router = inject(Router);
  const permission: unknown = route.data['permission'];
  const requirement =
    permission && typeof permission === 'object' ? (permission as Record<string, unknown>) : {};
  return typeof requirement['functionCode'] === 'string' &&
    typeof requirement['actionCode'] === 'string' &&
    session.can(requirement['functionCode'], requirement['actionCode'])
    ? true
    : router.createUrlTree(['/admin/forbidden']);
};

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
                (link) => session.can(link.permission.functionCode, link.permission.actionCode),
              )?.path ?? '/admin/forbidden')
            : '/login',
        ]),
      ),
    );
};

export const centralAdminGuard: CanActivateFn = () =>
  inject(AuthSession).isCentralAdmin() ? true : inject(Router).createUrlTree(['/admin/forbidden']);
