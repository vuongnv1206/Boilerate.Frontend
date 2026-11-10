import { Component, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { BaseComponent, applyServerErrors, clearServerErrors } from '@core/base';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { AUTH_FORM_STYLES } from '@api/identity/models/identity.dto';
import { IdentityAuthService } from '@api/identity/services/identity-auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [SHARED_IMPORTS],
  templateUrl: './forgot-password.component.html',
  styles: AUTH_FORM_STYLES,
})
export class ForgotPasswordComponent extends BaseComponent {
  // System variables
  readonly saving = signal(false);
  readonly sentMessage = signal('');

  // Business variables
  readonly form: FormGroup<{
    email: FormControl<string>;
  }>;

  constructor(
    private readonly authService: IdentityAuthService,
    private readonly fb: FormBuilder,
  ) {
    super();
    this.form = this.fb.nonNullable.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  submit(): void {
    if (this.saving()) return;
    this.errorMessage.set('');
    clearServerErrors(this.form);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const email = this.form.controls.email.getRawValue().trim();
    this.run(this.authService.forgotPassword({ email }), {
      busy: this.saving,
      onSuccess: (message) => {
        this.sentMessage.set(
          message || 'Nếu địa chỉ email hợp lệ, hệ thống đã gửi hướng dẫn đặt lại mật khẩu.',
        );
      },
      onError: (apiError) => {
        if (apiError.kind === 'validation') {
          applyServerErrors(this.form, apiError.fieldErrors);
        }
      },
    });
  }
}

export { ForgotPasswordComponent as ForgotPassword };
