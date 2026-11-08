import { Directive, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { ApiError } from '../http/api-error';
import { normalizeApiError } from '../http/normalize-api-error';
import { BaseComponent } from './base.component';
import { applyServerErrors, clearServerErrors } from './form-errors.util';
import { LeaveConfirmation } from './leave-confirmation';

export interface SubmitFormOptions<TDto> {
  readonly successMessage?: string;
  readonly fieldAliases?: Readonly<Record<string, string>>;
  readonly disableWhileSaving?: boolean;
  readonly onSuccess?: (saved: TDto) => void;
  readonly onError?: (error: ApiError) => void;
}

/**
 * Generic base class for Create / Update forms (`-io` screens & panels).
 * Automatically manages:
 * - Optimistic concurrency `version` extraction & `409 Conflict` draft preservation
 * - FluentValidation `ProblemDetails` field mapping (`applyServerErrors`) + unmapped summary errors
 * - Revision tracking so edits typed during an in-flight save are never overwritten
 * - `confirmLeave()` integration with `unsavedChangesGuard`
 */
@Directive()
export abstract class BaseFormComponent<
  TDto,
  TForm extends FormGroup = FormGroup,
> extends BaseComponent {
  protected readonly leaveConfirmation = inject(LeaveConfirmation, { optional: true });
  protected readonly fieldErrorAliases: Readonly<Record<string, string>> = {};

  readonly record = signal<TDto | null>(null);
  readonly version = signal<string | null>(null);
  readonly saving = signal(false);
  readonly conflict = signal(false);
  readonly summaryErrors = signal<readonly string[]>([]);

  private revision = 0;
  private trackingBound = false;

  abstract readonly form: TForm;

  confirmLeave(): boolean | Promise<boolean> {
    if (this.leaveConfirmation) {
      return this.leaveConfirmation.request(this.form.dirty, this.saving());
    }
    return !this.saving();
  }

  protected initFormTracking(): void {
    if (this.trackingBound) return;
    this.trackingBound = true;
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.form.dirty) {
        this.revision += 1;
      }
    });
  }

  protected bindRecord(dto: TDto, applyToForm: (dto: TDto) => void): void {
    this.initFormTracking();
    this.record.set(dto);
    this.version.set(extractVersion(dto));
    this.conflict.set(false);
    this.errorMessage.set('');
    this.summaryErrors.set([]);
    clearServerErrors(this.form);
    applyToForm(dto);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  protected submitForm(
    saveFactory: (
      rawValue: ReturnType<TForm['getRawValue']>,
      version: string | null,
    ) => Observable<TDto>,
    options: SubmitFormOptions<TDto> = {},
  ): void {
    if (this.saving()) return;
    this.initFormTracking();
    this.conflict.set(false);
    this.errorMessage.set('');
    this.summaryErrors.set([]);
    clearServerErrors(this.form);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const submittedRevision = this.revision;
    const rawValue = this.form.getRawValue() as ReturnType<TForm['getRawValue']>;
    const currentVersion = this.version();
    const lockControls = options.disableWhileSaving === true && this.form.enabled;

    this.saving.set(true);
    if (lockControls) {
      this.form.disable({ emitEvent: false });
    }

    saveFactory(rawValue, currentVersion)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (lockControls) {
            this.form.enable({ emitEvent: false });
          }
          this.saving.set(false);
        }),
      )
      .subscribe({
        next: (saved) => {
          this.record.set(saved);
          const nextVersion = extractVersion(saved);
          if (nextVersion !== null) {
            this.version.set(nextVersion);
          }
          if (this.revision === submittedRevision) {
            this.form.markAsPristine();
          }
          if (options.successMessage) {
            this.toast.success(options.successMessage);
          }
          options.onSuccess?.(saved);
        },
        error: (rawError: unknown) => {
          const apiError = normalizeApiError(rawError);
          if (apiError.kind === 'validation') {
            const unmapped = applyServerErrors(
              this.form,
              apiError.fieldErrors,
              options.fieldAliases ?? this.fieldErrorAliases,
            );
            const unmappedMessages = unmapped.flatMap((entry) => entry.messages);
            if (unmappedMessages.length > 0) {
              this.summaryErrors.set(unmappedMessages);
            } else if (Object.keys(apiError.fieldErrors).length === 0) {
              this.summaryErrors.set([apiError.message]);
            }
          } else if (apiError.kind === 'conflict') {
            this.conflict.set(true);
            this.errorMessage.set(apiError.message);
          } else {
            this.errorMessage.set(apiError.message);
          }
          options.onError?.(apiError);
        },
      });
  }
}

function extractVersion(dto: unknown): string | null {
  if (!dto || typeof dto !== 'object') return null;
  const candidate = (dto as Record<string, unknown>)['version'];
  return typeof candidate === 'string' ? candidate : null;
}
