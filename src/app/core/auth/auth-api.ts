import { HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiRequestOptions, ApiService } from '../http/api.service';
import { SKIP_AUTH } from './auth-context';
import {
  AuthorizationDto,
  ExternalLoginEndpoint,
  ExternalTokenWire,
  LoginRequest,
  TokenResponse,
} from './auth.dto';

/** HTTP calls of the session. Holds no state; every call skips the auth interceptor. */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  constructor(private readonly api: ApiService) {}

  login(request: LoginRequest): Observable<TokenResponse> {
    return this.api.post<TokenResponse>('tokens/session', request, this.cookieOptions());
  }

  loginExternal(endpoint: ExternalLoginEndpoint, payload: unknown): Observable<TokenResponse> {
    return this.api.post<ExternalTokenWire>(endpoint, payload, this.anonymousOptions()).pipe(
      map((wire) => {
        const userId = wire.userId || readJwtUserId(wire.token);
        if (!userId) throw new Error('Máy chủ trả về phiên đăng nhập không hợp lệ.');
        return { ...wire, userId };
      }),
    );
  }

  /** The refresh cookie belongs to the server; the browser only sends it back. */
  refresh(): Observable<TokenResponse> {
    return this.api.post<TokenResponse>('tokens/session/refresh', null, this.cookieOptions());
  }

  logout(): Observable<void> {
    return this.api.delete<void>('tokens/session', undefined, this.cookieOptions());
  }

  getAuthorization(accessToken: string): Observable<AuthorizationDto> {
    return this.api.get<AuthorizationDto>('personal/authorization', undefined, {
      ...this.anonymousOptions(),
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  private anonymousOptions(): ApiRequestOptions {
    return { context: new HttpContext().set(SKIP_AUTH, true) };
  }

  private cookieOptions(): ApiRequestOptions {
    return {
      ...this.anonymousOptions(),
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      withCredentials: true,
    };
  }
}

function readJwtUserId(jwt: string): string {
  try {
    const payload = (jwt.split('.')[1] ?? '').replace(/-/gu, '+').replace(/_/gu, '/');
    const claims = JSON.parse(
      atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')),
    ) as Record<string, unknown>;
    const id =
      claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ??
      claims['sub'] ??
      claims['uid'];
    return typeof id === 'string' ? id : '';
  } catch {
    return '';
  }
}
