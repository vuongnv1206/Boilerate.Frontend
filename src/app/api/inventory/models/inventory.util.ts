import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { DigitalStockInputDto, MAX_STOCK_QUANTITY } from './inventory.dto';

const INVENTORY_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u;

const requiredTrimmed: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

const utf8Max8000: ValidatorFn = (control) =>
  typeof control.value === 'string' && new TextEncoder().encode(control.value).length <= 8000
    ? null
    : { contentSize: true };

export function createInventoryAdjustmentForm() {
  return new FormGroup({
    delta: new FormControl<number | null>(null, [
      Validators.required,
      (control) =>
        typeof control.value === 'number' &&
        Number.isInteger(control.value) &&
        control.value !== 0 &&
        Math.abs(control.value) <= MAX_STOCK_QUANTITY
          ? null
          : { delta: true },
    ]),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [requiredTrimmed, Validators.maxLength(1000)],
    }),
  });
}

export function createDigitalContentForm() {
  return new FormGroup({
    reference: new FormControl('', {
      nonNullable: true,
      validators: [
        requiredTrimmed,
        Validators.maxLength(100),
        Validators.pattern(INVENTORY_CODE_PATTERN),
      ],
    }),
    content: new FormControl('', {
      nonNullable: true,
      validators: [requiredTrimmed, utf8Max8000],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
  });
}

export function createWorkspaceDigitalImportForm() {
  return new FormGroup({
    productId: new FormControl('', {
      nonNullable: true,
      validators: [requiredTrimmed, Validators.maxLength(64)],
    }),
    version: new FormControl('', {
      nonNullable: true,
      validators: [requiredTrimmed, Validators.maxLength(128)],
    }),
    batch: new FormControl('', {
      nonNullable: true,
      validators: [requiredTrimmed],
    }),
  });
}

interface ParsedDigitalBatch {
  readonly items: readonly DigitalStockInputDto[];
  readonly error: string | null;
}

export function parseDigitalBatchLines(raw: string): ParsedDigitalBatch {
  const lines = raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return { items: [], error: 'Nhập ít nhất một dòng theo mẫu MA_THAM_CHIEU|NOI_DUNG.' };
  }
  const items: DigitalStockInputDto[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const separator = line.indexOf('|');
    if (separator <= 0 || separator === line.length - 1) {
      return {
        items: [],
        error: `Dòng ${index + 1} chưa đúng định dạng MA_THAM_CHIEU|NOI_DUNG.`,
      };
    }
    const reference = line.slice(0, separator).trim();
    const content = line.slice(separator + 1).trim();
    if (!INVENTORY_CODE_PATTERN.test(reference)) {
      return {
        items: [],
        error: `Mã tham chiếu ở dòng ${index + 1} chỉ gồm chữ, số, dấu chấm, gạch nối hoặc gạch dưới (tối đa 100 ký tự).`,
      };
    }
    const normalizedRef = reference.toUpperCase();
    if (seen.has(normalizedRef)) {
      return {
        items: [],
        error: `Mã tham chiếu "${reference}" bị trùng ở dòng ${index + 1}.`,
      };
    }
    if (!content || new TextEncoder().encode(content).length > 8000) {
      return {
        items: [],
        error: `Nội dung ở dòng ${index + 1} phải từ 1 đến 8.000 byte UTF-8.`,
      };
    }
    seen.add(normalizedRef);
    items.push({ reference, content });
  }
  return { items, error: null };
}
