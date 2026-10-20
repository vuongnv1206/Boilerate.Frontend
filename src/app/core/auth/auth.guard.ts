import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthSession } from './auth-session';

export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(AuthSession);
  const router = inject(Router);
  return session.restore().pipe(
    map(
      (signedIn) =>
        signedIn ||
        router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url },
        }),
    ),
  );
};
