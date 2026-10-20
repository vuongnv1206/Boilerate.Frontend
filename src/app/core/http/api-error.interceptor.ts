import { DOCUMENT } from '@angular/common';
import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { RUNTIME_CONFIG } from '../config/runtime-config.token';
import { isApiRequestUrl } from './api-url';
import { normalizeApiError } from './normalize-api-error';

export const SKIP_API_ERROR_NORMALIZATION = new HttpContextToken<boolean>(() => false);

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(RUNTIME_CONFIG);
  const document = inject(DOCUMENT);
  if (
    request.context.get(SKIP_API_ERROR_NORMALIZATION) ||
    !isApiRequestUrl(request.url, config.apiBaseUrl, document.baseURI)
  ) {
    return next(request);
  }
  return next(request).pipe(
    catchError((error: unknown) => throwError(() => normalizeApiError(error))),
  );
};
