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

export interface ExternalTokenWire {
  readonly userId?: string;
  readonly token: string;
  readonly refreshToken?: string;
  readonly refreshTokenExpiryTime?: string;
  readonly sessionId: string;
  readonly accessTokenExpiresAt: string;
}
