export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface TokenResponse {
  readonly userId: string;
  readonly token: string;
  readonly sessionId: string;
  readonly accessTokenExpiresAt: string;
}

/** External sign-in (Google, Facebook) answers without `userId`; it is read from the JWT instead. */
export interface ExternalTokenWire {
  readonly userId?: string;
  readonly token: string;
  readonly sessionId: string;
  readonly accessTokenExpiresAt: string;
}

export type ExternalLoginEndpoint = 'auth/google' | 'auth/google/code' | 'auth/facebook';

/** GET personal/authorization. Each permission reads `Permissions.<Function>.<Action>`. */
export interface AuthorizationDto {
  readonly permissions: readonly string[];
  readonly isCentralAdmin: boolean;
}
