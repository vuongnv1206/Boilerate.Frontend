import { normalizeApiBaseUrl } from '../config/runtime-config';

/** Resource paths stay below the configured base. Use HttpParams for query parameters. */
export function apiUrl(apiBaseUrl: string, resource: string): string {
  const base = normalizeApiBaseUrl(apiBaseUrl);
  if (!resource) return base;
  let decoded: string;
  try {
    decoded = decodeURIComponent(resource);
  } catch {
    throw new Error('API resource path is invalid.');
  }
  if (
    /^[/\\]/u.test(decoded) ||
    /[\s\\?#:]/u.test(decoded) ||
    decoded.split('/').some((part) => part === '.' || part === '..')
  ) {
    throw new Error('API resource must be a relative path within the configured base.');
  }
  return `${base === '/' ? '' : base}/${resource}`;
}

export function isApiRequestUrl(
  requestUrl: string,
  apiBaseUrl: string,
  documentBaseUrl: string,
): boolean {
  try {
    const base = new URL(apiBaseUrl, documentBaseUrl);
    const request = new URL(requestUrl, documentBaseUrl);
    const prefix = base.pathname.replace(/\/+$/u, '');
    return (
      request.origin === base.origin &&
      (request.pathname === prefix || request.pathname.startsWith(`${prefix}/`))
    );
  } catch {
    return false;
  }
}
