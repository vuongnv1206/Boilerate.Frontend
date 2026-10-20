export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface TokenResponse {
  readonly token: string;
  readonly refreshToken: string;
  readonly refreshTokenExpiryTime: string;
  readonly sessionId: string;
  readonly accessTokenExpiresAt: string;
}
