import { Component, HostListener, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, distinctUntilChanged, finalize, map } from 'rxjs';
import { BaseComponent } from '@core/base/base.component';
import { LeaveConfirmation } from '@core/base/leave-confirmation';
import { applyServerErrors, clearServerErrors } from '@core/base/form-errors.util';
import { normalizeApiError } from '@core/http/normalize-api-error';
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

function createDiscountForm() {
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

type DiscountForm = ReturnType<typeof createDiscountForm>;

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
function vietnamDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? ''
    : new Date(date.valueOf() + 7 * 3_600_000).toISOString().slice(0, 19);
}

function utcDateTime(value: string): string | null {
  return value ? new Date(`${value}+07:00`).toISOString() : null;
}

function discountFormValue(record?: DiscountDto): ReturnType<DiscountForm['getRawValue']> {
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

function discountRequest(form: DiscountForm, record?: DiscountDto | null): SaveDiscountRequest {
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
export class DiscountIo extends BaseComponent implements OnInit {
  // System variables
  readonly ready = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly summaryErrors = signal<readonly string[]>([]);
  private loadRequest?: Subscription;

  // Business variables
  readonly record = signal<DiscountDto | null>(null);
  readonly form = createDiscountForm();
  readonly kinds = [...DISCOUNT_KIND_OPTIONS];
  readonly canWrite = computed(() => this.can('Discount', this.record() ? 'Update' : 'Create'));

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly discountsService: DiscountsService,
    readonly confirmation: LeaveConfirmation,
  ) {
    super();
  }

  ngOnInit(): void {
    // Editing again makes the previous result and server errors out of date.
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.saved.set(false);
      this.summaryErrors.set([]);
      clearServerErrors(this.form);
    });
    // `new` has no `:id`; opening another discount reuses this screen and loads again.
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => this.loadDetail(id));
  }

  loadDetail(id: string | null): void {
    this.loadRequest?.unsubscribe();
    this.errorMessage.set('');
    this.summaryErrors.set([]);
    this.saved.set(false);
    this.ready.set(false);
    this.showDiscount(null);
    if (id === null) {
      this.ready.set(true);
      return;
    }
    this.loading.set(true);
    this.loadRequest = this.discountsService
      .getById(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (discount) => {
          this.showDiscount(discount);
          this.ready.set(true);
        },
        error: (error: unknown) => this.errorMessage.set(normalizeApiError(error).message),
      });
  }

  async retry(): Promise<void> {
    if (await this.confirmLeave()) this.loadDetail(this.route.snapshot.paramMap.get('id'));
  }

  saveChange(): void {
    if (!this.ready() || !this.canWrite() || this.saving()) return;
    clearServerErrors(this.form);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const current = this.record();
    const request = discountRequest(this.form, current);
    this.saving.set(true);
    this.errorMessage.set('');
    this.summaryErrors.set([]);
    this.saved.set(false);
    this.form.disable({ emitEvent: false });
    (current
      ? this.discountsService.updateDiscount(current.id, current.version, request)
      : this.discountsService.create(request)
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (discount) => {
          this.saving.set(false);
          this.showDiscount(discount);
          this.saved.set(true);
          if (!current) {
            void this.router.navigate(['/admin/discounts', discount.id], {
              replaceUrl: true,
              queryParamsHandling: 'preserve',
            });
          }
        },
        // The form keeps what was typed, also on 409: the user checks and saves again.
        error: (error: unknown) => {
          this.saving.set(false);
          // Enable first: enabling re-runs validators and would drop the server errors.
          this.form.enable({ emitEvent: false });
          const apiError = normalizeApiError(error);
          const unmapped = applyServerErrors(
            this.form,
            apiError.fieldErrors,
            DISCOUNT_FIELD_ALIASES,
          );
          this.summaryErrors.set(unmapped.flatMap((entry) => entry.messages));
          this.errorMessage.set(
            apiError.kind === 'conflict'
              ? 'Mã đã thay đổi hoặc trùng. Bản nhập được giữ lại; hãy kiểm tra dữ liệu trước khi lưu lại.'
              : apiError.message,
          );
        },
      });
  }

  error(control: AbstractControl): string | null {
    if (!control.invalid || !(control.dirty || control.touched)) return null;
    const server: unknown = control.errors?.['server'];
    if (Array.isArray(server)) return server.join(' ');
    if (control.errors?.['integer']) return 'Nhập số nguyên hợp lệ.';
    return validationMessage(control) || 'Kiểm tra lại giá trị này.';
  }

  /** Asked by `unsavedChangesGuard` before leaving, and before reloading the discount. */
  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(this.form.dirty, this.saving());
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty || this.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  private showDiscount(discount: DiscountDto | null): void {
    this.record.set(discount);
    this.form.reset(discountFormValue(discount ?? undefined), { emitEvent: false });
    if (this.canWrite()) this.form.enable({ emitEvent: false });
    else this.form.disable({ emitEvent: false });
  }
}
