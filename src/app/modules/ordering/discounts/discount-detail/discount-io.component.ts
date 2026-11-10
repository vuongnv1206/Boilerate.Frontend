import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  effect,
  signal,
} from '@angular/core';
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
import { AuthSession } from '@core/auth/auth-session';
import { LeaveConfirmation } from '@core/base';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { applyServerErrors, clearServerErrors } from '@core/base/form-errors.util';
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
export class DiscountIo implements OnInit {
  // System variables
  private subscription?: Subscription;
  private generation = 0;
  private revision = 0;
  private currentId = 'new';

  // Business variables
  readonly form = createDiscountForm();
  readonly kinds = [...DISCOUNT_KIND_OPTIONS];
  readonly record = signal<DiscountDto | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly ready = signal(false);
  readonly loadError = signal('');
  readonly summary = signal<readonly string[]>([]);
  readonly saved = signal(false);

  readonly canWrite = computed(() =>
    this.session.can('Discount', this.record() ? 'Update' : 'Create'),
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
    private readonly discountsService: DiscountsService,
    private readonly session: AuthSession,
    readonly confirmation: LeaveConfirmation,
  ) {
    effect(() => {
      const canWrite = this.canWrite() && !this.saving();
      if (canWrite) this.form.enable({ emitEvent: false });
      else this.form.disable({ emitEvent: false });
    });
    this.destroyRef.onDestroy(() => {
      this.generation += 1;
      this.subscription?.unsubscribe();
    });
  }

  ngOnInit(): void {
    if (!this.canWrite()) this.form.disable({ emitEvent: false });
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.revision += 1;
      this.saved.set(false);
      this.summary.set([]);
      clearServerErrors(this.form);
    });
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? 'new'),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => this.load(id));
  }

  load(id: string): void {
    this.currentId = id;
    const generation = ++this.generation;
    this.subscription?.unsubscribe();
    this.ready.set(false);
    this.loading.set(id !== 'new');
    this.loadError.set('');
    this.summary.set([]);
    this.saved.set(false);
    this.record.set(null);
    this.form.reset(discountFormValue(), { emitEvent: false });
    if (id === 'new') {
      this.ready.set(true);
      return;
    }
    this.subscription = this.discountsService
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (record) => {
          if (generation !== this.generation) return;
          this.record.set(record);
          this.form.reset(discountFormValue(record), { emitEvent: false });
          if (!this.canWrite()) this.form.disable({ emitEvent: false });
          this.loading.set(false);
          this.ready.set(true);
        },
        error: (err: unknown) => {
          if (generation !== this.generation) return;
          this.loading.set(false);
          this.loadError.set(normalizeApiError(err).message);
        },
      });
  }

  save(): void {
    if (!this.ready() || !this.canWrite() || this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const wasNew = !this.route.snapshot.paramMap.has('id');
    const current = this.record();
    const value = discountRequest(this.form, current);
    const generation = this.generation;
    const revision = this.revision;
    this.saving.set(true);
    this.form.disable({ emitEvent: false });
    this.loadError.set('');
    this.summary.set([]);
    const request = current
      ? this.discountsService.updateDiscount(current.id, current.version, value)
      : this.discountsService.create(value);
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (generation === this.generation) this.saving.set(false);
        }),
      )
      .subscribe({
        next: (saved) => {
          if (generation !== this.generation) return;
          this.record.set(saved);
          if (revision === this.revision) {
            this.form.reset(discountFormValue(saved), { emitEvent: false });
            this.saved.set(true);
          }
          if (wasNew && !this.form.dirty) {
            void this.router.navigate(['/admin/discounts', saved.id], {
              replaceUrl: true,
              queryParamsHandling: 'preserve',
            });
          }
        },
        error: (err: unknown) => {
          if (generation !== this.generation) return;
          const api = normalizeApiError(err);
          this.loadError.set(
            api.kind === 'conflict'
              ? 'Mã đã thay đổi hoặc trùng. Bản nhập được giữ lại; hãy kiểm tra dữ liệu trước khi lưu lại.'
              : api.message,
          );
          this.summary.set(
            applyServerErrors(this.form, api.fieldErrors, DISCOUNT_FIELD_ALIASES).flatMap(
              (entry) => entry.messages,
            ),
          );
        },
      });
  }

  async retry(): Promise<void> {
    if (await this.confirmLeave()) this.load(this.currentId);
  }

  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(this.form.dirty, this.saving());
  }

  error(control: AbstractControl): string | null {
    if (!control.invalid || !(control.dirty || control.touched)) return null;
    const server: unknown = control.errors?.['server'];
    if (Array.isArray(server)) return server.join(' ');
    if (control.errors?.['integer']) return 'Nhập số nguyên hợp lệ.';
    return validationMessage(control) || 'Kiểm tra lại giá trị này.';
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty || this.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
