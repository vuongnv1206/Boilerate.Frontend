import { Injectable, signal } from '@angular/core';
import { Observable, Subscription, catchError, map, of, tap, throwError } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { normalizeApiError } from '../http/normalize-api-error';

export interface GuestVerificationResult {
  readonly email: string;
}

@Injectable({ providedIn: 'root' })
export class GuestAccessSession {
  private restoreSub: Subscription | null = null;

  private readonly verifiedEmailState = signal<string | null>(null);
  private readonly codeSentState = signal(false);
  private readonly submittingState = signal(false);
  private readonly errorState = signal('');

  readonly verifiedEmail = this.verifiedEmailState.asReadonly();
  readonly codeSent = this.codeSentState.asReadonly();
  readonly submitting = this.submittingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  constructor(private readonly api: ApiClient) {}

  restore(onRestored?: (email: string) => void): void {
    this.restoreSub?.unsubscribe();
    this.restoreSub = this.api
      .get<GuestVerificationResult>('storefront/access/me', { withCredentials: true })
      .pipe(
        tap((res) => {
          this.verifiedEmailState.set(res.email);
          onRestored?.(res.email);
        }),
        catchError(() => {
          this.reset();
          return of(null);
        }),
      )
      .subscribe();
  }

  requestCode(email: string): Observable<void> {
    this.submittingState.set(true);
    this.errorState.set('');
    return this.api
      .post<{ readonly message: string }>(
        'storefront/access/request-code',
        { email },
        { withCredentials: true },
      )
      .pipe(
        map(() => undefined),
        tap(() => {
          this.codeSentState.set(true);
          this.submittingState.set(false);
        }),
        catchError((err: unknown) => {
          this.errorState.set(normalizeApiError(err).message);
          this.submittingState.set(false);
          return throwError(() => err);
        }),
      );
  }

  verifyCode(email: string, code: string): Observable<string> {
    this.submittingState.set(true);
    this.errorState.set('');
    return this.api
      .post<GuestVerificationResult>(
        'storefront/access/verify-code',
        { email, code },
        { withCredentials: true },
      )
      .pipe(
        map((res) => res.email),
        tap((verified) => {
          this.verifiedEmailState.set(verified);
          this.codeSentState.set(false);
          this.submittingState.set(false);
        }),
        catchError((err: unknown) => {
          this.errorState.set(normalizeApiError(err).message);
          this.submittingState.set(false);
          return throwError(() => err);
        }),
      );
  }

  reset(): void {
    this.restoreSub?.unsubscribe();
    this.verifiedEmailState.set(null);
    this.codeSentState.set(false);
    this.errorState.set('');
  }
}
