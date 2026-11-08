export function createOperationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

interface StoredOperation {
  readonly fingerprint: string;
  readonly operationId: string;
}

/**
 * Keeps the same OperationId when retrying after transient network/server errors,
 * and rotates to a fresh OperationId whenever payload changes or a terminal outcome occurs.
 */
export class IdempotentActionTracker {
  private readonly entries = new Map<string, StoredOperation>();

  resolve(actionKey: string, payload: unknown): string {
    const fingerprint = stableFingerprint(payload);
    const existing = this.entries.get(actionKey);
    if (existing && existing.fingerprint === fingerprint) {
      return existing.operationId;
    }
    const operationId = createOperationId();
    this.entries.set(actionKey, { fingerprint, operationId });
    return operationId;
  }

  clear(actionKey: string): void {
    this.entries.delete(actionKey);
  }

  clearAll(): void {
    this.entries.clear();
  }
}

function stableFingerprint(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return `${typeof value}:${String(value)}`;
  if (Array.isArray(value)) return `[${value.map(stableFingerprint).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableFingerprint(record[key])}`).join(',')}}`;
}
