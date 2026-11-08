export interface ListQuery {
  readonly q: string;
  readonly page: number;
}

export function readListQuery(values: Readonly<Record<string, unknown>>): ListQuery {
  const rawPage = values['page'];
  const parsed = typeof rawPage === 'string' && /^\d+$/u.test(rawPage) ? Number(rawPage) : NaN;
  return {
    q: typeof values['q'] === 'string' ? values['q'].trim() : '',
    page: Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1,
  };
}

export function readPositiveIntParam(
  params: Readonly<Record<string, string | undefined>>,
  key: string,
  fallback: number,
  max = 10_000,
): number {
  const raw = params[key];
  if (!raw || !/^\d+$/u.test(raw)) return fallback;
  const parsed = Number(raw);
  return parsed >= 1 && parsed <= max ? parsed : fallback;
}

export function readTrimmedParam(
  params: Readonly<Record<string, string | undefined>>,
  key: string,
  maxLength = 120,
): string {
  const raw = params[key];
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, maxLength);
}
