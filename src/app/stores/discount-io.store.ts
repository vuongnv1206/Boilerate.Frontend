import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subscription, catchError, defer, finalize, tap } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { DiscountForm, discountFormValue, discountRequest } from '@forms/discount.form';
import { DiscountDto } from '@models/discount.dto';
import { DiscountsService } from '@services/discounts.service';
import { applyServerErrors, clearServerErrors } from '@shared/forms/apply-server-errors';

@Injectable()
export class DiscountIoStore {
  private readonly service = inject(DiscountsService);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recordState = signal<DiscountDto | null>(null);
  private readonly loadingState = signal(false);
  private readonly savingState = signal(false);
  private readonly readyState = signal(false);
  private readonly errorState = signal('');
  private readonly summaryState = signal<readonly string[]>([]);
  private readonly savedState = signal(false);
  private subscription?: Subscription;
  private form?: DiscountForm;
  private generation = 0;
  private revision = 0;
  private id = 'new';
  readonly record = this.recordState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly ready = this.readyState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly summary = this.summaryState.asReadonly();
  readonly saved = this.savedState.asReadonly();
  readonly canWrite = computed(() =>
    this.session.can('Discount', this.record() ? 'Update' : 'Create'),
  );

  constructor() {
    effect(() => {
      const canWrite = this.canWrite() && !this.saving();
      if (this.form) {
        if (canWrite) this.form.enable({ emitEvent: false });
        else this.form.disable({ emitEvent: false });
      }
    });
    this.destroyRef.onDestroy(() => {
      this.generation++;
      this.subscription?.unsubscribe();
    });
  }
  setForm(form: DiscountForm): void {
    this.form = form;
    if (!this.canWrite()) form.disable({ emitEvent: false });
    form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.revision++;
      this.savedState.set(false);
      this.summaryState.set([]);
      clearServerErrors(form);
    });
  }
  load(id: string): void {
    if (!this.form) return;
    this.id = id;
    const generation = ++this.generation;
    this.subscription?.unsubscribe();
    this.readyState.set(false);
    this.loadingState.set(id !== 'new');
    this.errorState.set('');
    this.summaryState.set([]);
    this.savedState.set(false);
    this.recordState.set(null);
    this.form.reset(discountFormValue(), { emitEvent: false });
    if (id === 'new') {
      this.readyState.set(true);
      return;
    }
    this.subscription = this.service
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (record) => {
          if (generation !== this.generation || !this.form) return;
          this.recordState.set(record);
          this.form.reset(discountFormValue(record), { emitEvent: false });
          if (!this.canWrite()) this.form.disable({ emitEvent: false });
          this.loadingState.set(false);
          this.readyState.set(true);
        },
        error: (error: unknown) => {
          if (generation !== this.generation) return;
          this.loadingState.set(false);
          this.errorState.set(normalizeApiError(error).message);
        },
      });
  }
  retry(): void {
    this.load(this.id);
  }
  save(): Observable<DiscountDto> {
    return defer(() => {
      const form = this.form;
      if (!form || !this.ready() || !this.canWrite() || this.saving()) return EMPTY;
      form.markAllAsTouched();
      if (form.invalid) return EMPTY;
      const current = this.record();
      const value = discountRequest(form, current);
      const generation = this.generation;
      const revision = this.revision;
      this.savingState.set(true);
      form.disable({ emitEvent: false });
      this.errorState.set('');
      this.summaryState.set([]);
      const request = current
        ? this.service.update(current.id, current.version, value)
        : this.service.create(value);
      return request.pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((saved) => {
          if (generation !== this.generation) return;
          this.recordState.set(saved);
          if (revision === this.revision) {
            form.reset(discountFormValue(saved), { emitEvent: false });
            this.savedState.set(true);
          }
        }),
        catchError((error: unknown) => {
          if (generation === this.generation) {
            const api = normalizeApiError(error);
            this.errorState.set(
              api.kind === 'conflict'
                ? 'Mã đã thay đổi hoặc trùng. Bản nhập được giữ lại; hãy kiểm tra dữ liệu trước khi lưu lại.'
                : api.message,
            );
            this.summaryState.set(
              applyServerErrors(form, api.fieldErrors, {
                startsAtUtc: 'startsAt',
                endsAtUtc: 'endsAt',
              }).flatMap((entry) => entry.messages),
            );
          }
          return EMPTY;
        }),
        finalize(() => {
          if (generation === this.generation) this.savingState.set(false);
        }),
      );
    });
  }
}
