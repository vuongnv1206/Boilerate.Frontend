import { AbstractControl, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';

const requiredName = (length: number) => [
  Validators.required,
  Validators.pattern(/\S/u),
  Validators.maxLength(length),
];
export function createRoleForm() {
  return new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: requiredName(256) }),
    description: new FormControl('', { nonNullable: true }),
  });
}
export function createCapabilityForm() {
  return new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[a-z0-9_-]{1,100}$/iu)],
    }),
    name: new FormControl('', { nonNullable: true, validators: requiredName(100) }),
    isActive: new FormControl(true, { nonNullable: true }),
    groupId: new FormControl('', { nonNullable: true }),
  });
}
export function createFunctionGroupForm() {
  return new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[a-z0-9_-]{1,100}$/iu)],
    }),
    name: new FormControl('', { nonNullable: true, validators: requiredName(100) }),
    sortOrder: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/u)],
    }),
  });
}

const matchingPasswords: ValidatorFn = (control: AbstractControl) => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
};

export function createUserForm() {
  return new FormGroup(
    {
      firstName: new FormControl('', {
        nonNullable: true,
        validators: requiredName(75),
      }),
      lastName: new FormControl('', {
        nonNullable: true,
        validators: requiredName(75),
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      userName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(6)],
      }),
      phoneNumber: new FormControl('', { nonNullable: true }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(9)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      deleteCurrentImage: new FormControl(false, { nonNullable: true }),
    },
    { validators: matchingPasswords },
  );
}
