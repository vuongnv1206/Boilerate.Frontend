import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';

/** After a permission-affecting write, wait for the session to pick up the new authorization snapshot. */
@Injectable({ providedIn: 'root' })
export class AuthorizationRefresh {
  constructor(private readonly session: AuthSession) {}

  after<T>(write: Observable<T>): Observable<T> {
    return write.pipe(
      switchMap((saved) =>
        this.session.authorizationChanged().pipe(
          catchError(() => of(undefined)),
          map(() => saved),
        ),
      ),
    );
  }
}
