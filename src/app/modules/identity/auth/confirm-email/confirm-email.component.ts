import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { BaseComponent } from '@core/base';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  AUTH_FORM_STYLES,
  CONFIRM_MODE_OPTIONS,
  ConfirmMode,
} from '@api/identity/models/identity.dto';
import { IdentityAuthService } from '@api/identity/services/identity-auth.service';

@Component({
  selector: 'app-confirm-email',
  imports: [SHARED_IMPORTS],
  templateUrl: './confirm-email.component.html',
  styles: AUTH_FORM_STYLES,
})
export class ConfirmEmailComponent extends BaseComponent implements OnInit {
  // System variables
  readonly confirming = signal(false);
  readonly confirmedMessage = signal('');

  // Business variables
  readonly modeOptions = CONFIRM_MODE_OPTIONS;
  readonly form: FormGroup<{
    mode: FormControl<ConfirmMode>;
    userId: FormControl<string>;
    code: FormControl<string>;
  }>;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly authService: IdentityAuthService,
    private readonly fb: FormBuilder,
  ) {
    super();
    this.form = this.fb.nonNullable.group({
      mode: ['email' as ConfirmMode],
      userId: ['', [Validators.required]],
      code: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const userId = (params.get('userId') ?? params.get('UserId') ?? '').trim();
    const code = (params.get('code') ?? params.get('Code') ?? '').trim();
    const rawMode = (params.get('mode') ?? params.get('type') ?? '').toLowerCase();
    const mode: ConfirmMode = rawMode === 'phone' ? 'phone' : 'email';

    this.form.patchValue({ mode, userId, code }, { emitEvent: false });
    if (userId && code) {
      this.confirmNow(mode, userId, code);
    }
  }

  selectMode(mode: ConfirmMode): void {
    this.form.controls.mode.setValue(mode);
    this.errorMessage.set('');
  }

  submit(): void {
    if (this.confirming()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    this.confirmNow(raw.mode, raw.userId.trim(), raw.code.trim());
  }

  private confirmNow(mode: ConfirmMode, userId: string, code: string): void {
    this.confirmedMessage.set('');
    const request$ =
      mode === 'phone'
        ? this.authService.confirmPhoneNumber(userId, code)
        : this.authService.confirmEmail(userId, code);
    this.run(request$, {
      busy: this.confirming,
      onSuccess: (message) => {
        this.confirmedMessage.set(
          message ||
            (mode === 'phone'
              ? 'Đã xác nhận số điện thoại thành công.'
              : 'Đã xác nhận địa chỉ email thành công.'),
        );
      },
    });
  }
}

export { ConfirmEmailComponent as ConfirmEmail };
