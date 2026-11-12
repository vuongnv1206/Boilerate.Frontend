const VN_DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const normalized =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/u.test(value) && !/(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
      ? `${value}Z`
      : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatVnDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? VN_DATE_TIME.format(date) : '—';
}
