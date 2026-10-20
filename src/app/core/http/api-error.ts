export type ApiErrorKind =
  | 'network'
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'rate-limit'
  | 'server'
  | 'unexpected';

export type ApiFieldErrors = Readonly<Record<string, readonly string[]>>;

export interface ApiErrorDetails {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly message: string;
  readonly code?: string;
  readonly traceId?: string;
  readonly fieldErrors: ApiFieldErrors;
}

/** Deliberately excludes raw response bodies, URLs, headers and stack traces from the server. */
export class ApiError extends Error implements ApiErrorDetails {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly code?: string;
  readonly traceId?: string;
  readonly fieldErrors: ApiFieldErrors;

  constructor(details: ApiErrorDetails) {
    super(details.message);
    this.name = 'ApiError';
    this.status = details.status;
    this.kind = details.kind;
    this.code = details.code;
    this.traceId = details.traceId;
    this.fieldErrors = details.fieldErrors;
  }
}
