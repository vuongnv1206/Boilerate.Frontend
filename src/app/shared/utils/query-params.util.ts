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
