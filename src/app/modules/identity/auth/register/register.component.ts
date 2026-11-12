import { Component, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { BaseComponent } from '@core/base/base.component';
import { applyServerErrors, clearServerErrors } from '@core/base/form-errors.util';
import { validationMessage } from '@shared/forms/validation-message';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { AUTH_FORM_STYLES } from '@api/identity/models/identity.dto';
import { IdentityAuthService } from '@api/identity/services/identity-auth.service';

const requiredTrimmed = (maxLength: number) => [
  Validators.required,
  Validators.pattern(/\S/u),
  Validators.maxLength(maxLength),
];

const confirmPasswordMatch: ValidatorFn = (control: AbstractControl) => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-register',
  imports: [SHARED_IMPORTS],
  templateUrl: './register.component.html',
  styles: AUTH_FORM_STYLES,
})
export class RegisterComponent extends BaseComponent {
  // System variables
  readonly saving = signal(false);
  readonly successMessage = signal('');

  // Business variables
  readonly form: FormGroup<{
    firstName: FormControl<string>;
    lastName: FormControl<string>;
    email: FormControl<string>;
    userName: FormControl<string>;
    phoneNumber: FormControl<string>;
    password: FormControl<string>;
    confirmPassword: FormControl<string>;
  }>;

  constructor(
    private readonly authService: IdentityAuthService,
    private readonly fb: FormBuilder,
  ) {
    super();
    this.form = this.fb.nonNullable.group(
      {
        firstName: ['', requiredTrimmed(75)],
        lastName: ['', requiredTrimmed(75)],
        email: ['', [Validators.required, Validators.email]],
        userName: ['', [Validators.required, Validators.minLength(6)]],
        phoneNumber: [''],
        password: ['', [Validators.required, Validators.minLength(9)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: confirmPasswordMatch },
    );
  }

  submit(): void {
    if (this.saving()) return;
    this.errorMessage.set('');
    clearServerErrors(this.form);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    this.run(
      this.authService.selfRegister({
        firstName: raw.firstName.trim(),
        lastName: raw.lastName.trim(),
        email: raw.email.trim(),
        userName: raw.userName.trim(),
        password: raw.password,
        confirmPassword: raw.confirmPassword,
        phoneNumber: raw.phoneNumber.trim() || null,
      }),
      {
        busy: this.saving,
        onSuccess: (message) => {
          this.successMessage.set(
            message || 'Đăng ký tài khoản thành công. Vui lòng kiểm tra email để xác nhận.',
          );
        },
        onError: (apiError) => {
          if (apiError.kind === 'validation') {
            applyServerErrors(this.form, apiError.fieldErrors);
          }
        },
      },
    );
  }

  fieldError(
    field:
      | 'firstName'
      | 'lastName'
      | 'email'
      | 'userName'
      | 'phoneNumber'
      | 'password'
      | 'confirmPassword',
  ): string {
    const control = this.form.controls[field];
    if (field === 'confirmPassword' && control.touched && this.form.hasError('passwordMismatch')) {
      return 'Mật khẩu nhập lại chưa khớp.';
    }
    return validationMessage(control);
  }
}

export { RegisterComponent as Register };
