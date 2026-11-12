import { Component, HostListener, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup } from '@angular/forms';
import { finalize } from 'rxjs';
import { BaseComponent } from '@core/base/base.component';
import { applyServerErrors, clearServerErrors } from '@core/base/form-errors.util';
import { LeaveConfirmation } from '@core/base/leave-confirmation';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { validationMessage } from '@shared/forms/validation-message';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { StorefrontSettings } from '@api/storefront/models/storefront-settings.dto';
import { StorefrontSettingsService } from '@api/storefront/services/storefront-settings.service';

@Component({
  selector: 'app-storefront-settings',
  host: { class: 'collection-screen' },
  imports: [SHARED_IMPORTS],
  providers: [LeaveConfirmation],
  templateUrl: './storefront-settings.component.html',
})
export class StorefrontSettingsComponent extends BaseComponent implements OnInit {
  // System variables
  readonly saving = signal(false);
  readonly notice = signal('');
  readonly summaryErrors = signal<readonly string[]>([]);

  // Business variables
  readonly record = signal<StorefrontSettings | null>(null);
  readonly canEdit = computed(() => this.can('StorefrontSettings', 'Update'));
  readonly form = new FormGroup({
    bankTransferEnabled: new FormControl(false, { nonNullable: true }),
    bankName: new FormControl('', { nonNullable: true }),
    accountNumber: new FormControl('', { nonNullable: true }),
    accountHolder: new FormControl('', { nonNullable: true }),
    branch: new FormControl('', { nonNullable: true }),
    instructions: new FormControl('', { nonNullable: true }),
  });

  constructor(
    private readonly settingsService: StorefrontSettingsService,
    readonly confirmation: LeaveConfirmation,
  ) {
    super();
  }

  ngOnInit(): void {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.notice.set(''));
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.form.disable({ emitEvent: false });
    this.settingsService
      .getAdminSettings()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (settings) => this.showSettings(settings),
        error: (error: unknown) => this.errorMessage.set(normalizeApiError(error).message),
      });
  }

  saveChange(): void {
    const record = this.record();
    if (!record || !this.canEdit() || this.saving()) return;
    clearServerErrors(this.form);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.errorMessage.set('');
    this.summaryErrors.set([]);
    this.notice.set('');
    this.form.disable({ emitEvent: false });
    this.settingsService
      .updateAdminSettings({
        version: record.version,
        bankTransferEnabled: value.bankTransferEnabled,
        bankName: value.bankName || null,
        accountNumber: value.accountNumber || null,
        accountHolder: value.accountHolder || null,
        branch: value.branch || null,
        instructions: value.instructions || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.showSettings(saved);
          this.notice.set('Đã lưu thông tin thanh toán.');
        },
        // The form keeps what was typed; field errors go next to their fields.
        error: (error: unknown) => {
          this.saving.set(false);
          // Enable first: enabling re-runs validators and would drop the server errors.
          this.form.enable({ emitEvent: false });
          const apiError = normalizeApiError(error);
          const unmapped = applyServerErrors(this.form, apiError.fieldErrors).flatMap(
            (entry) => entry.messages,
          );
          if (apiError.kind !== 'validation') {
            this.errorMessage.set(apiError.message);
            this.summaryErrors.set(unmapped);
          } else if (unmapped.length || Object.keys(apiError.fieldErrors).length) {
            this.summaryErrors.set(unmapped);
          } else {
            this.summaryErrors.set([apiError.message]);
          }
        },
      });
  }

  fieldError(name: string): string | null {
    return validationMessage(this.form.get(name) ?? undefined) || null;
  }

  /** Asked by `unsavedChangesGuard` before leaving. */
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

  private showSettings(settings: StorefrontSettings): void {
    this.record.set(settings);
    this.form.reset(
      {
        bankTransferEnabled: settings.bankTransferEnabled,
        bankName: settings.bankName ?? '',
        accountNumber: settings.accountNumber ?? '',
        accountHolder: settings.accountHolder ?? '',
        branch: settings.branch ?? '',
        instructions: settings.instructions ?? '',
      },
      { emitEvent: false },
    );
    if (this.canEdit()) this.form.enable({ emitEvent: false });
    else this.form.disable({ emitEvent: false });
  }
}
