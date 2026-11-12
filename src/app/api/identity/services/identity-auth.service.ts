import { HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SKIP_AUTH } from '@core/auth/auth-context';
import { AuthSession } from '@core/auth/auth-session';
import { ApiRequestOptions, ApiService } from '@core/http/api.service';
import {
  CreateUserRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../models/identity.dto';

function cleanTextResponse(value: string): string {
  return value.trim().replace(/^"|"$/gu, '').replace(/\\n/gu, ' ').replace(/\r?\n/gu, ' ').trim();
}

@Injectable({ providedIn: 'root' })
export class IdentityAuthService {
  constructor(
    private readonly api: ApiService,
    private readonly session: AuthSession,
  ) {}

  selfRegister(request: CreateUserRequest): Observable<string> {
    return this.api
      .text('POST', 'users/self-register', request, this.anonymousOptions())
      .pipe(map(cleanTextResponse));
  }

  confirmEmail(userId: string, code: string): Observable<string> {
    return this.api
      .text('GET', 'users/confirm-email', undefined, {
        ...this.anonymousOptions(),
        params: { userId, code },
      })
      .pipe(map(cleanTextResponse));
  }

  confirmPhoneNumber(userId: string, code: string): Observable<string> {
    return this.api
      .text('GET', 'users/confirm-phone-number', undefined, {
        ...this.anonymousOptions(),
        params: { userId, code },
      })
      .pipe(map(cleanTextResponse));
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<string> {
    return this.api
      .text('POST', 'users/forgot-password', request, this.anonymousOptions())
      .pipe(map(cleanTextResponse));
  }

  resetPassword(request: ResetPasswordRequest): Observable<string> {
    return this.api
      .text('POST', 'users/reset-password', request, this.anonymousOptions())
      .pipe(map(cleanTextResponse));
  }

  googleSignIn(idToken: string): Observable<void> {
    return this.session.signInExternal('auth/google', { idToken });
  }

  googleCodeSignIn(authorizedCode: string): Observable<void> {
    return this.session.signInExternal('auth/google/code', authorizedCode);
  }

  facebookSignIn(idToken: string): Observable<void> {
    return this.session.signInExternal('auth/facebook', { idToken });
  }

  private anonymousOptions(): ApiRequestOptions {
    return { context: new HttpContext().set(SKIP_AUTH, true) };
  }
}
