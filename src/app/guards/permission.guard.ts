import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { COLLECTION_LINKS } from '@constants/navigation.constants';

export const permissionGuard: CanActivateFn = (route) => {
  const session = inject(AuthSession);
  const router = inject(Router);
  const permission: unknown = route.data['permission'];
  return typeof permission === 'string' && session.hasPermission(permission)
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
            ? (COLLECTION_LINKS.find((link) => session.hasPermission(link.permission))?.path ??
              '/admin/forbidden')
            : '/login',
        ]),
      ),
    );
};
