import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { DiscountDto, SaveDiscountRequest } from '@models/discount.dto';

const integer: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  control.value === null || (Number.isSafeInteger(control.value) && control.value >= 0)
    ? null
    : { integer: true };

export function createDiscountForm() {
  return new FormGroup(
    {
      code: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9._-]{1,32}$/u)],
      }),
      name: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/\S/u), Validators.maxLength(160)],
      }),
      kind: new FormControl<1 | 2>(1, { nonNullable: true }),
      value: new FormControl<number | null>(null, [
        Validators.required,
        integer,
        Validators.min(1),
        Validators.max(Number.MAX_SAFE_INTEGER),
      ]),
      minimumSubtotal: new FormControl<number | null>(0, [
        Validators.required,
        integer,
        Validators.max(Number.MAX_SAFE_INTEGER),
      ]),
      startsAt: new FormControl('', { nonNullable: true }),
      endsAt: new FormControl('', { nonNullable: true }),
      usageLimit: new FormControl<number | null>(null, [
        integer,
        Validators.min(1),
        Validators.max(2147483647),
      ]),
      isActive: new FormControl(true, { nonNullable: true }),
    },
    { validators: [discountRules] },
  );
}
export type DiscountForm = ReturnType<typeof createDiscountForm>;

function discountRules(control: AbstractControl): ValidationErrors | null {
  const value = control.get('value')?.value as number | null;
  const kind = control.get('kind')?.value as number;
  const start = control.get('startsAt')?.value as string;
  const end = control.get('endsAt')?.value as string;
  const errors = {
    ...(kind === 1 && value !== null && value > 99 ? { percent: true } : {}),
    ...(start && end && start >= end ? { dateRange: true } : {}),
  } satisfies ValidationErrors;
  return Object.keys(errors).length ? errors : null;
}

/** Date-time fields are explicitly Vietnamese wall time, independent of the browser timezone. */
export function vietnamDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? ''
    : new Date(date.valueOf() + 7 * 3_600_000).toISOString().slice(0, 19);
}
function utcDateTime(value: string): string | null {
  return value ? new Date(`${value}+07:00`).toISOString() : null;
}
export function discountFormValue(record?: DiscountDto): ReturnType<DiscountForm['getRawValue']> {
  return {
    code: record?.code ?? '',
    name: record?.name ?? '',
    kind: record?.kind ?? 1,
    value: record?.value ?? null,
    minimumSubtotal: record?.minimumSubtotal ?? 0,
    startsAt: vietnamDateTime(record?.startsAtUtc ?? null),
    endsAt: vietnamDateTime(record?.endsAtUtc ?? null),
    usageLimit: record?.usageLimit ?? null,
    isActive: record?.isActive ?? true,
  };
}
export function discountRequest(
  form: DiscountForm,
  record?: DiscountDto | null,
): SaveDiscountRequest {
  const value = form.getRawValue();
  const saved = record ? discountFormValue(record) : null;
  if (value.value === null || value.minimumSubtotal === null)
    throw new Error('The discount amount and minimum subtotal are required.');
  return {
    code: value.code.trim().toUpperCase(),
    name: value.name.trim(),
    kind: value.kind,
    value: value.value,
    minimumSubtotal: value.minimumSubtotal,
    startsAtUtc:
      record && saved && value.startsAt === saved.startsAt
        ? record.startsAtUtc
        : utcDateTime(value.startsAt),
    endsAtUtc:
      record && saved && value.endsAt === saved.endsAt
        ? record.endsAtUtc
        : utcDateTime(value.endsAt),
    usageLimit: value.usageLimit,
    isActive: value.isActive,
  };
}
