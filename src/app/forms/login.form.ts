import { FormControl, FormGroup, Validators } from '@angular/forms';

export function createLoginForm() {
  return new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
}
