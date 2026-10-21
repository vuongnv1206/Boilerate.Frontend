import { Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY, Observable, catchError, defer, finalize } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { LoginRequest } from '@core/auth/auth.dto';

@Injectable()
export class LoginStore {
  private readonly session = inject(AuthSession);
  private readonly busy = signal(false);
  private readonly failure = signal('');
  readonly saving = this.busy.asReadonly();
  readonly error = computed(() => this.failure() || this.session.restoreError());
  readonly logoutFailed = this.session.logoutFailed;
  readonly canRestore = computed(
    () => !!this.session.restoreError() && !this.session.logoutFailed(),
  );

  signIn(request: LoginRequest): Observable<void> {
    return defer(() => {
      if (this.busy()) return EMPTY;
      this.busy.set(true);
      this.failure.set('');
      return this.session.signIn(request).pipe(
        catchError((error: unknown) => {
          this.failure.set(normalizeApiError(error).message);
          return EMPTY;
        }),
        finalize(() => this.busy.set(false)),
      );
    });
  }
  restore(): Observable<boolean> {
    return defer(() => {
      if (this.busy()) return EMPTY;
      this.busy.set(true);
      return this.session.restore().pipe(finalize(() => this.busy.set(false)));
    });
  }
  retrySignOut(): Observable<void> {
    return defer(() => {
      if (this.busy()) return EMPTY;
      this.busy.set(true);
      return this.session.signOut().pipe(finalize(() => this.busy.set(false)));
    });
  }
}
