import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new Subject<string>();
  private readonly busy = signal(false);
  private readonly failure = signal('');

  readonly form = createLoginForm();
  readonly saving = this.busy.asReadonly();
  readonly error = computed(() => this.failure() || this.session.restoreError());
  readonly logoutFailed = this.session.logoutFailed;
  readonly canRestore = computed(
    () => !!this.session.restoreError() && !this.session.logoutFailed(),
  );

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

  retrySignOut(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.session
      .signOut()
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  restore(returnUrl: string | null): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.session
      .restore()
      .pipe(
        tap((signedIn) => {
          if (signedIn) void this.router.navigateByUrl(this.target(returnUrl));
        }),
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  signIn(returnUrl: string | null): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.requests.next(this.target(returnUrl));
  }

  private target(returnUrl: string | null): string {
    return returnUrl && /^\/admin(?:[/?]|$)/u.test(returnUrl)
      ? returnUrl
      : '/admin/collections/products';
  }
}
