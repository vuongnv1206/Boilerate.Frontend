import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { applyServerErrors, clearServerErrors } from './apply-server-errors';

function profileForm() {
  return new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    address: new FormGroup({ city: new FormControl('', { nonNullable: true }) }),
    contacts: new FormArray([new FormGroup({ email: new FormControl('', { nonNullable: true }) })]),
  });
}

describe('Server validation mapping', () => {
  it('maps PascalCase and nested array DTO paths onto typed controls', () => {
    const form = profileForm();
    expect(
      applyServerErrors(form, {
        Name: ['Tên đã được sử dụng.'],
        'Address.City': ['Chọn thành phố.'],
        'Contacts[0].Email': ['Email đã tồn tại.'],
      }),
    ).toEqual([]);
    expect(form.controls.name.errors).toEqual({ required: true, server: ['Tên đã được sử dụng.'] });
    expect(form.controls.address.controls.city.errors?.['server']).toEqual(['Chọn thành phố.']);
    expect(form.controls.contacts.at(0).controls.email.touched).toBe(true);
  });

  it('returns unmapped errors for a summary without assigning them to another control', () => {
    const form = profileForm();
    const result = applyServerErrors(form, {
      Unknown: ['Không tìm thấy trường.'],
      'Contacts[2].Email': ['Ngoài danh sách.'],
    });
    expect(result.map((error) => error.field)).toEqual(['Unknown', 'Contacts[2].Email']);
    expect(form.errors).toBeNull();
    expect(form.controls.name.errors).toEqual({ required: true });
  });

  it('uses explicit aliases when an API property and form field have different names', () => {
    const form = profileForm();
    applyServerErrors(form, { DisplayName: ['Tên không hợp lệ.'] }, { DisplayName: 'name' });
    expect(form.controls.name.errors?.['server']).toEqual(['Tên không hợp lệ.']);
  });

  it('removes stale server errors while retaining client validation errors', () => {
    const form = profileForm();
    applyServerErrors(form, { Name: ['Tên đã tồn tại.'], 'Address.City': ['Chọn thành phố.'] });
    applyServerErrors(form, { 'Address.City': ['Thành phố chưa hỗ trợ.'] });
    expect(form.controls.name.errors).toEqual({ required: true });
    expect(form.controls.address.controls.city.errors?.['server']).toEqual([
      'Thành phố chưa hỗ trợ.',
    ]);
    clearServerErrors(form);
    expect(form.controls.address.controls.city.errors).toBeNull();
    expect(form.controls.name.errors).toEqual({ required: true });
  });
});
