import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

export type ServerValidationErrors = Readonly<Record<string, readonly string[]>>;

export interface UnmappedServerError {
  readonly field: string;
  readonly messages: readonly string[];
}

/** Clears only old server errors, preserving required/pattern and other validator errors. */
export function clearServerErrors(control: AbstractControl): void {
  if (control.errors && Object.hasOwn(control.errors, 'server')) {
    const { server: _server, ...remaining } = control.errors;
    void _server;
    control.setErrors(Object.keys(remaining).length ? remaining : null);
  }
  if (control instanceof FormGroup) {
    Object.values(control.controls).forEach((child: unknown) => {
      if (child instanceof AbstractControl) clearServerErrors(child);
    });
  } else if (control instanceof FormArray) {
    control.controls.forEach((child: AbstractControl) => clearServerErrors(child));
  }
}

/** Case-insensitive DTO paths support PascalCase, nested groups and array indexes. */
export function applyServerErrors(
  form: AbstractControl,
  errors: ServerValidationErrors,
  fieldAliases: Readonly<Record<string, string>> = {},
): readonly UnmappedServerError[] {
  clearServerErrors(form);
  const unmapped: UnmappedServerError[] = [];
  for (const [field, messages] of Object.entries(errors)) {
    if (!messages.length) continue;
    const normalize = (value: string): string =>
      value
        .replace(/^\$\./u, '')
        .replace(/\[(\d+)\]/gu, '.$1')
        .toLowerCase();
    const alias = Object.keys(fieldAliases).find((key) => normalize(key) === normalize(field));
    const path = alias ? (fieldAliases[alias] ?? field) : field;
    const control = findControl(form, path);
    if (!control) {
      unmapped.push({ field, messages });
      continue;
    }
    const previous = control.errors?.['server'];
    const serverMessages = Array.isArray(previous) ? [...previous, ...messages] : [...messages];
    control.setErrors({ ...control.errors, server: serverMessages });
    control.markAsTouched();
  }
  return unmapped;
}

function findControl(root: AbstractControl, path: string): AbstractControl | undefined {
  const normalized = path.replace(/^\$\./u, '').replace(/\[(\d+)\]/gu, '.$1');
  const segments = normalized.split('.');
  let control: AbstractControl | undefined = root;
  for (const segment of segments) {
    if (!segment || ['__proto__', 'constructor', 'prototype'].includes(segment)) return undefined;
    if (control instanceof FormGroup) {
      const key: string | undefined =
        Object.keys(control.controls).find((candidate) => candidate === segment) ??
        Object.keys(control.controls).find(
          (candidate) => candidate.toLowerCase() === segment.toLowerCase(),
        );
      control = key ? (control.controls[key] as AbstractControl | undefined) : undefined;
    } else if (control instanceof FormArray && /^\d+$/u.test(segment)) {
      control = control.at(Number(segment));
    } else {
      return undefined;
    }
  }
  return control;
}
