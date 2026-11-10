import { Component } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Observable, of } from 'rxjs';
import { BaseEditorComponent } from '@core/base/base-editor.component';
import { LeaveConfirmation } from '@core/base/leave-confirmation';
import { clearServerErrors } from '@core/base/form-errors.util';
import { ApiError } from '@core/http/api-error';
import { validationMessage } from '@shared/forms/validation-message';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  DISCOUNT_FIELD_ALIASES,
  DISCOUNT_KIND_OPTIONS,
  DiscountDto,
  DiscountKind,
  SaveDiscountRequest,
} from '@api/ordering/models/discount.dto';
import { DiscountsService } from '@api/ordering/services/discounts.service';

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
      kind: new FormControl<DiscountKind>(1, { nonNullable: true }),
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
  if (value.value === null || value.minimumSubtotal === null) {
    throw new Error('The discount amount and minimum subtotal are required.');
  }
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

@Component({
  selector: 'app-discount-io',
  host: { class: 'collection-screen' },
  imports: [SHARED_IMPORTS],
  providers: [LeaveConfirmation],
  templateUrl: './discount-io.component.html',
})
export class DiscountIo extends BaseEditorComponent<DiscountDto, DiscountForm> {
  // System variables
  protected override readonly lockFormWhileSaving = true;

  // Business variables
  readonly form = createDiscountForm();
  readonly kinds = [...DISCOUNT_KIND_OPTIONS];

  constructor(private readonly discountsService: DiscountsService) {
    super();
  }

  error(control: AbstractControl): string | null {
    if (!control.invalid || !(control.dirty || control.touched)) return null;
    const server: unknown = control.errors?.['server'];
    if (Array.isArray(server)) return server.join(' ');
    if (control.errors?.['integer']) return 'Nhập số nguyên hợp lệ.';
    return validationMessage(control) || 'Kiểm tra lại giá trị này.';
  }

  protected fetchRecord(id: string | null): Observable<DiscountDto | null> {
    return id === null ? of(null) : this.discountsService.getById(id);
  }

  protected hydrate(record: DiscountDto | null): void {
    this.form.reset(discountFormValue(record ?? undefined), { emitEvent: false });
  }

  protected persist(record: DiscountDto | null): Observable<DiscountDto> {
    const value = discountRequest(this.form, record);
    return record
      ? this.discountsService.updateDiscount(record.id, record.version, value)
      : this.discountsService.create(value);
  }

  protected canWriteRecord(record: DiscountDto | null): boolean {
    return this.can('Discount', record ? 'Update' : 'Create');
  }

  protected override afterSaved(saved: DiscountDto, wasNew: boolean): void {
    if (wasNew) this.openCreated(['/admin/discounts', saved.id]);
  }

  protected override fieldAliases(): Readonly<Record<string, string>> {
    return DISCOUNT_FIELD_ALIASES;
  }

  protected override onDraftChange(): void {
    this.summaryErrors.set([]);
    clearServerErrors(this.form);
  }

  protected override saveErrorMessage(error: ApiError): string {
    return error.kind === 'conflict'
      ? 'Mã đã thay đổi hoặc trùng. Bản nhập được giữ lại; hãy kiểm tra dữ liệu trước khi lưu lại.'
      : error.message;
  }
}
