import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, exhaustMap, catchError, EMPTY, finalize, tap } from 'rxjs';
import { AuthSession } from '../core/auth/auth-session';
import { normalizeApiError } from '../core/http/normalize-api-error';
import { createLoginForm } from '@forms/login.form';

@Injectable()
export class LoginStore {
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly requests = new Subject<string>();
  private readonly busy = signal(false);
  private readonly failure = signal('');

  readonly form = createLoginForm();
  readonly saving = this.busy.asReadonly();
  readonly error = this.failure.asReadonly();

  constructor() {
    this.requests
      .pipe(
        exhaustMap((returnUrl) => {
          this.busy.set(true);
          this.failure.set('');
          return this.session.signIn(this.form.getRawValue()).pipe(
            tap(() => {
              void this.router.navigateByUrl(returnUrl);
            }),
            catchError((error: unknown) => {
              this.failure.set(normalizeApiError(error).message);
              return EMPTY;
            }),
            finalize(() => this.busy.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  signIn(returnUrl: string | null): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const target =
      returnUrl && /^\/admin(?:[/?]|$)/u.test(returnUrl)
        ? returnUrl
        : '/admin/collections/products';
    this.requests.next(target);
  }
}
