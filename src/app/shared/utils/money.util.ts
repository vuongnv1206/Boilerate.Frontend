const VND_FORMATTER = new Intl.NumberFormat('vi-VN');

export function formatVnd(amount: number | bigint | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '0 ₫';
  if (typeof amount === 'bigint') {
    return `${VND_FORMATTER.format(amount)} ₫`;
  }
  if (typeof amount === 'string') {
    const trimmed = amount.trim();
    if (/^-?\d+$/u.test(trimmed)) {
      return `${VND_FORMATTER.format(BigInt(trimmed))} ₫`;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? `${VND_FORMATTER.format(Math.round(parsed))} ₫` : '0 ₫';
  }
  return Number.isFinite(amount) ? `${VND_FORMATTER.format(Math.round(amount))} ₫` : '0 ₫';
}

export function parseBigIntVnd(value: number | bigint | string | null | undefined): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? BigInt(Math.trunc(value)) : 0n;
  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (/^-?\d+$/u.test(cleaned)) return BigInt(cleaned);
    const asNum = Number(cleaned);
    if (Number.isFinite(asNum)) return BigInt(Math.trunc(asNum));
  }
  return 0n;
}
