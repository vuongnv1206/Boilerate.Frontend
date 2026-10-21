import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { RUNTIME_CONFIG } from '../config/runtime-config.token';
import { isApiRequestUrl } from '../http/api-url';
import { normalizeApiError } from '../http/normalize-api-error';
import { SKIP_AUTH, SKIP_AUTHORIZATION_REFRESH } from './auth-context';
import { AuthSession } from './auth-session';

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
  const router = inject(Router);
  const token = session.accessToken();
  const version = session.getVersion();
  const authorized = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;
  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (
        normalizeApiError(error).status === 403 &&
        !request.context.get(SKIP_AUTHORIZATION_REFRESH)
      ) {
        return session.reloadAuthorization().pipe(
          catchError(() => throwError(() => error)),
          switchMap(() => throwError(() => error)),
        );
      }
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        !token ||
        session.getVersion() !== version
      ) {
        return throwError(() => error);
      }
      // A newer request may already have refreshed the same expired token.
      const currentToken = session.accessToken();
      const retry =
        currentToken && currentToken !== token
          ? next(request.clone({ setHeaders: { Authorization: `Bearer ${currentToken}` } }))
          : session.refresh().pipe(
              catchError((refreshError: unknown) => {
                if (
                  session.getVersion() === version &&
                  normalizeApiError(refreshError).status === 401
                ) {
                  session.clear();
                  void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
                }
                return throwError(() => refreshError);
              }),
              switchMap((freshToken) =>
                next(request.clone({ setHeaders: { Authorization: `Bearer ${freshToken}` } })),
              ),
            );
      return retry.pipe(
        catchError((retryError: unknown) => {
          if (
            session.getVersion() === version &&
            retryError instanceof HttpErrorResponse &&
            retryError.status === 401
          ) {
            session.clear();
            void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
          }
          return throwError(() => retryError);
        }),
      );
    }),
  );
};
