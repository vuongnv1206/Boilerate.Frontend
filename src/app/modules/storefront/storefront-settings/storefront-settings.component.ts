import { Component, computed } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Observable } from 'rxjs';
import { BaseEditorComponent } from '@core/base/base-editor.component';
import { LeaveConfirmation } from '@core/base/leave-confirmation';
import { validationMessage } from '@shared/forms/validation-message';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  StorefrontSettings,
  UpdateStorefrontSettings,
} from '@api/storefront/models/storefront-settings.dto';
import { StorefrontSettingsService } from '@api/storefront/services/storefront-settings.service';

@Component({
  selector: 'app-storefront-settings',
  host: { class: 'collection-screen' },
  imports: [SHARED_IMPORTS],
  providers: [LeaveConfirmation],
  templateUrl: './storefront-settings.component.html',
})
export class StorefrontSettingsComponent extends BaseEditorComponent<StorefrontSettings> {
  // System variables
  protected override readonly lockFormWhileSaving = true;
  protected override readonly bannerOnValidationError = false;

  // Business variables
  readonly form = new FormGroup({
    bankTransferEnabled: new FormControl(false, { nonNullable: true }),
    bankName: new FormControl('', { nonNullable: true }),
    accountNumber: new FormControl('', { nonNullable: true }),
    accountHolder: new FormControl('', { nonNullable: true }),
    branch: new FormControl('', { nonNullable: true }),
    instructions: new FormControl('', { nonNullable: true }),
  });

  readonly notice = computed(() => (this.saved() ? 'Đã lưu thông tin thanh toán.' : ''));
  readonly canEdit = computed(() => this.session.can('StorefrontSettings', 'Update'));
  readonly leaveVisible = computed(() => this.confirmation.visible());

  constructor(private readonly settingsService: StorefrontSettingsService) {
    super();
  }

  fieldError(name: string): string | null {
    const message = validationMessage(this.form.get(name) ?? undefined);
    return message || null;
  }

  answerLeave(allowed: boolean): void {
    this.confirmation.answer(allowed);
  }

  protected fetchRecord(): Observable<StorefrontSettings> {
    return this.settingsService.getAdminSettings();
  }

  protected hydrate(record: StorefrontSettings | null): void {
    this.form.reset(
      {
        bankTransferEnabled: record?.bankTransferEnabled ?? false,
        bankName: record?.bankName ?? '',
        accountNumber: record?.accountNumber ?? '',
        accountHolder: record?.accountHolder ?? '',
        branch: record?.branch ?? '',
        instructions: record?.instructions ?? '',
      },
      { emitEvent: false },
    );
  }

  protected persist(record: StorefrontSettings | null): Observable<StorefrontSettings> {
    const raw = this.form.getRawValue();
    const payload: UpdateStorefrontSettings = {
      version: record?.version ?? '',
      bankTransferEnabled: raw.bankTransferEnabled,
      bankName: raw.bankName || null,
      accountNumber: raw.accountNumber || null,
      accountHolder: raw.accountHolder || null,
      branch: raw.branch || null,
      instructions: raw.instructions || null,
    };
    return this.settingsService.updateAdminSettings(payload);
  }

  protected canWriteRecord(record: StorefrontSettings | null): boolean {
    return record !== null && this.canEdit();
  }
}
