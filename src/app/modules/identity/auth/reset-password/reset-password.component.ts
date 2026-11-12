import { Component, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { BaseComponent } from '@core/base/base.component';
import { applyServerErrors, clearServerErrors } from '@core/base/form-errors.util';
import { validationMessage } from '@shared/forms/validation-message';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { AUTH_FORM_STYLES } from '@api/identity/models/identity.dto';
import { IdentityAuthService } from '@api/identity/services/identity-auth.service';

const confirmPasswordMatch: ValidatorFn = (control: AbstractControl) => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-reset-password',
  imports: [SHARED_IMPORTS],
  templateUrl: './reset-password.component.html',
  styles: AUTH_FORM_STYLES,
})
export class ResetPasswordComponent extends BaseComponent implements OnInit {
  // System variables
  readonly saving = signal(false);
  readonly completedMessage = signal('');

  // Business variables
  readonly form: FormGroup<{
    email: FormControl<string>;
    token: FormControl<string>;
    password: FormControl<string>;
    confirmPassword: FormControl<string>;
  }>;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly authService: IdentityAuthService,
    private readonly fb: FormBuilder,
  ) {
    super();
    this.form = this.fb.nonNullable.group(
      {
        email: ['', [Validators.required, Validators.email]],
        token: ['', [Validators.required]],
        password: ['', [Validators.required, Validators.minLength(9)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: confirmPasswordMatch },
    );
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const email = (params.get('email') ?? params.get('Email') ?? '').trim();
    const token = (params.get('token') ?? params.get('Token') ?? params.get('code') ?? '').trim();
    this.form.patchValue({ email, token }, { emitEvent: false });
  }

  submit(): void {
    if (this.saving()) return;
    this.errorMessage.set('');
    clearServerErrors(this.form);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    this.run(
      this.authService.resetPassword({
        email: raw.email.trim(),
        token: raw.token.trim(),
        password: raw.password,
      }),
      {
        busy: this.saving,
        onSuccess: (message) => {
          this.completedMessage.set(message || 'Đã đặt lại mật khẩu thành công.');
        },
        onError: (apiError) => {
          if (apiError.kind === 'validation') {
            applyServerErrors(this.form, apiError.fieldErrors);
          }
        },
      },
    );
  }

  fieldError(field: 'email' | 'token' | 'password' | 'confirmPassword'): string {
    const control = this.form.controls[field];
    if (field === 'confirmPassword' && control.touched && this.form.hasError('passwordMismatch')) {
      return 'Mật khẩu nhập lại chưa khớp.';
    }
    return validationMessage(control);
  }
}

export { ResetPasswordComponent as ResetPassword };
