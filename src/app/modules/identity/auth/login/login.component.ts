import { Component, DestroyRef, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';

@Component({
  selector: 'app-login',
  imports: [SHARED_IMPORTS],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  // System variables
  private readonly busy = signal(false);
  private readonly failure = signal('');
  readonly saving = this.busy.asReadonly();
  readonly error = computed(() => this.failure() || this.session.restoreError());
  readonly logoutFailed: AuthSession['logoutFailed'];
  readonly canRestore = computed(
    () => !!this.session.restoreError() && !this.session.logoutFailed(),
  );

  // Business variables
  readonly form: FormGroup<{
    email: FormControl<string>;
    password: FormControl<string>;
  }>;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
    private readonly session: AuthSession,
    private readonly fb: FormBuilder,
  ) {
    this.logoutFailed = this.session.logoutFailed;
    this.form = this.fb.nonNullable.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  signIn(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.failure.set('');
    this.session
      .signIn(this.form.getRawValue())
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl(this.target()),
        error: (err: unknown) => this.failure.set(normalizeApiError(err).message),
      });
  }

  restore(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.session
      .restore()
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((signedIn) => {
        if (signedIn) void this.router.navigateByUrl(this.target());
      });
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

  private target(): string {
    const value = this.route.snapshot.queryParamMap.get('returnUrl');
    return value && /^\/(?:admin|shop)(?:[/?]|$)/u.test(value) ? value : '/admin';
  }
}

export { LoginComponent as Login };
