import { FormControl, FormGroup, Validators } from '@angular/forms';

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
