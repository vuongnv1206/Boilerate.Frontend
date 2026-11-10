import { Component, OnInit, computed, effect, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup } from '@angular/forms';
import { BaseFormComponent, LeaveConfirmation } from '@core/base';
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
export class StorefrontSettingsComponent
  extends BaseFormComponent<StorefrontSettings>
  implements OnInit
{
  // Business variables
  readonly form = new FormGroup({
    bankTransferEnabled: new FormControl(false, { nonNullable: true }),
    bankName: new FormControl('', { nonNullable: true }),
    accountNumber: new FormControl('', { nonNullable: true }),
    accountHolder: new FormControl('', { nonNullable: true }),
    branch: new FormControl('', { nonNullable: true }),
    instructions: new FormControl('', { nonNullable: true }),
  });

  readonly notice = signal('');
  readonly canEdit = computed(() => this.session.can('StorefrontSettings', 'Update'));
  readonly leaveVisible = computed(() => this.leaveConfirmation?.visible() ?? false);

  constructor(private readonly settingsService: StorefrontSettingsService) {
    super();
    effect(() => {
      const editable = this.canEdit();
      const isSaving = this.saving();
      const loaded = this.record() !== null;
      untracked(() => {
        if (!editable || isSaving || !loaded) {
          this.form.disable({ emitEvent: false });
        } else {
          this.form.enable({ emitEvent: false });
        }
      });
    });
  }

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.form.dirty) {
        this.notice.set('');
      }
    });
    this.load();
  }

  load(): void {
    this.notice.set('');
    this.run(this.settingsService.getAdminSettings(), {
      busy: this.loading,
      onSuccess: (settings) => {
        this.bindRecord(settings, (dto) => {
          this.form.setValue(
            {
              bankTransferEnabled: dto.bankTransferEnabled,
              bankName: dto.bankName ?? '',
              accountNumber: dto.accountNumber ?? '',
              accountHolder: dto.accountHolder ?? '',
              branch: dto.branch ?? '',
              instructions: dto.instructions ?? '',
            },
            { emitEvent: false },
          );
        });
        if (!this.canEdit()) {
          this.form.disable({ emitEvent: false });
        }
      },
    });
  }

  save(): void {
    if (!this.canEdit() || !this.record() || this.loading()) return;
    this.notice.set('');
    this.submitForm(
      (raw, version) => {
        const payload: UpdateStorefrontSettings = {
          version: version ?? '',
          bankTransferEnabled: raw.bankTransferEnabled,
          bankName: raw.bankName || null,
          accountNumber: raw.accountNumber || null,
          accountHolder: raw.accountHolder || null,
          branch: raw.branch || null,
          instructions: raw.instructions || null,
        };
        return this.settingsService.updateAdminSettings(payload);
      },
      {
        disableWhileSaving: true,
        onSuccess: () => {
          this.notice.set('Đã lưu thông tin thanh toán.');
        },
      },
    );
  }

  fieldError(name: string): string | null {
    const message = validationMessage(this.form.get(name) ?? undefined);
    return message || null;
  }

  answerLeave(allowed: boolean): void {
    this.leaveConfirmation?.answer(allowed);
  }
}
