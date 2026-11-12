import { DOCUMENT } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { EMPTY, catchError, concat, ignoreElements, switchMap, throwError } from 'rxjs';
import { RUNTIME_CONFIG } from '../config/runtime-config.token';
import { isApiRequestUrl } from '../http/api-url';
import { normalizeApiError } from '../http/normalize-api-error';
import { SKIP_AUTH } from './auth-context';
import { AuthSession } from './auth-session';

/**
 * Adds the access token to API requests.
 * - 403: re-read permissions, so menus and buttons follow the new rights; the error still surfaces.
 * - 401: refresh the token and retry once. If that is rejected too, the session has expired.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(RUNTIME_CONFIG);
  const document = inject(DOCUMENT);
  if (
    request.context.get(SKIP_AUTH) ||
    !isApiRequestUrl(request.url, config.apiBaseUrl, document.baseURI)
  ) {
    return next(request);
  }
  const session = inject(AuthSession);
  const token = session.accessToken();
  const sessionId = session.sessionId();
  const send = (bearer: string | null) =>
    next(bearer ? request.clone({ setHeaders: { Authorization: `Bearer ${bearer}` } }) : request);

  return send(token).pipe(
    catchError((error: unknown) => {
      const status = normalizeApiError(error).status;
      if (status === 403) {
        return concat(
          session.reloadAuthorization().pipe(
            ignoreElements(),
            catchError(() => EMPTY),
          ),
          throwError(() => error),
        );
      }
      // Never retry for another session: the user signed out or signed in again meanwhile.
      if (status !== 401 || !token || session.sessionId() !== sessionId) {
        return throwError(() => error);
      }
      // A request sent alongside this one may already have refreshed the expired token.
      const current = session.accessToken();
      const retry =
        current && current !== token ? send(current) : session.refresh().pipe(switchMap(send));
      return retry.pipe(
        catchError((retryError: unknown) => {
          if (normalizeApiError(retryError).status === 401 && session.sessionId() === sessionId) {
            session.expire();
          }
          return throwError(() => retryError);
        }),
      );
    }),
  );
};
