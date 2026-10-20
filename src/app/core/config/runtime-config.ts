export interface RuntimeConfig {
  readonly apiBaseUrl: string;
  readonly primeUiLicense?: string;
}

export class RuntimeConfigError extends Error {
  constructor(field: 'root' | 'apiBaseUrl' | 'primeUiLicense' | 'unknown') {
    const messages = {
      root: 'Runtime configuration must be an object.',
      apiBaseUrl:
        'Runtime configuration apiBaseUrl must be a root-relative path or HTTP(S) URL without credentials, query or fragment.',
      primeUiLicense:
        'Runtime configuration primeUiLicense must be a non-empty string when supplied.',
      unknown: 'Runtime configuration contains an unsupported setting.',
    };
    super(messages[field]);
    this.name = 'RuntimeConfigError';
  }
}

/** Public configuration only. Never put credentials or access tokens in this object. */
export function readRuntimeConfig(input: unknown): RuntimeConfig {
  if (input === undefined) return Object.freeze({ apiBaseUrl: '/api' });
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RuntimeConfigError('root');
  }

  const record = input as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== 'apiBaseUrl' && key !== 'primeUiLicense')) {
    throw new RuntimeConfigError('unknown');
  }

  const apiBaseUrl = normalizeApiBaseUrl(
    record['apiBaseUrl'] === undefined ? '/api' : record['apiBaseUrl'],
  );
  const license = record['primeUiLicense'];
  if (license !== undefined && (typeof license !== 'string' || !license.trim())) {
    throw new RuntimeConfigError('primeUiLicense');
  }

  return Object.freeze({
    apiBaseUrl,
    ...(typeof license === 'string' ? { primeUiLicense: license.trim() } : {}),
  });
}

export function normalizeApiBaseUrl(input: unknown): string {
  if (typeof input !== 'string' || !input || input.trim() !== input || /[\s\\?#]/u.test(input)) {
    throw new RuntimeConfigError('apiBaseUrl');
  }
  const rootRelative = input.startsWith('/') && !input.startsWith('//');
  if (!rootRelative && !/^https?:\/\//iu.test(input)) {
    throw new RuntimeConfigError('apiBaseUrl');
  }
  let parsed: URL;
  try {
    parsed = new URL(input, 'https://runtime.invalid');
  } catch {
    throw new RuntimeConfigError('apiBaseUrl');
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    hasUnsafePath(input.replace(/^https?:\/\/[^/]+/iu, ''))
  ) {
    throw new RuntimeConfigError('apiBaseUrl');
  }
  const normalizedPath = parsed.pathname.replace(/\/+$/u, '');
  return rootRelative ? normalizedPath || '/' : `${parsed.origin}${normalizedPath}`;
}

function hasUnsafePath(path: string): boolean {
  try {
    const decoded = decodeURIComponent(path);
    return (
      /[\\?#\s]/u.test(decoded) || decoded.split('/').some((part) => part === '.' || part === '..')
    );
  } catch {
    return true;
  }
}
