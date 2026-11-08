import { HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SKIP_AUTH } from '@core/auth/auth-context';
import { AuthSession } from '@core/auth/auth-session';
import { BaseApiService } from '@core/base';
import { ApiRequestOptions } from '@core/http/api-client';
import {
  CreateUserRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../models/identity.dto';

function cleanTextResponse(value: string): string {
  return value.trim().replace(/^"|"$/gu, '').replace(/\\n/gu, ' ').replace(/\r?\n/gu, ' ').trim();
}

@Injectable({ providedIn: 'root' })
export class IdentityAuthService extends BaseApiService {
  constructor(private readonly session: AuthSession) {
    super();
  }

  selfRegister(request: CreateUserRequest): Observable<string> {
    return this.postText('users/self-register', request, this.anonymousOptions()).pipe(
      map(cleanTextResponse),
    );
  }

  confirmEmail(userId: string, code: string): Observable<string> {
    return this.getText('users/confirm-email', { userId, code }, this.anonymousOptions()).pipe(
      map(cleanTextResponse),
    );
  }

  confirmPhoneNumber(userId: string, code: string): Observable<string> {
    return this.getText(
      'users/confirm-phone-number',
      { userId, code },
      this.anonymousOptions(),
    ).pipe(map(cleanTextResponse));
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<string> {
    return this.postText('users/forgot-password', request, this.anonymousOptions()).pipe(
      map(cleanTextResponse),
    );
  }

  resetPassword(request: ResetPasswordRequest): Observable<string> {
    return this.postText('users/reset-password', request, this.anonymousOptions()).pipe(
      map(cleanTextResponse),
    );
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
