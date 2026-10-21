import { describe, expect, it } from 'vitest';
import {
  createChoiceForm,
  createFieldForm,
  createProductTypeForm,
  productTypeErrorAliases,
} from '@forms/product-type.form';
import { applyServerErrors } from '@shared/forms/apply-server-errors';

describe('Product type request error paths', () => {
  it('maps filtered update/add indexes to the submitted controls after reordering', () => {
    const form = createProductTypeForm();
    const newField = createFieldForm();
    newField.patchValue({ code: 'NEW', label: 'New' });
    const existing = createFieldForm();
    existing.patchValue({ id: 'existing', code: 'OLD', label: 'Old' });
    const newChoice = createChoiceForm();
    existing.controls.choices.push(newChoice);
    const oldChoice = createChoiceForm();
    oldChoice.patchValue({ id: 'old-choice' });
    existing.controls.choices.push(oldChoice);
    form.controls.fields.push(newField);
    form.controls.fields.push(existing);
    const aliases = productTypeErrorAliases(form, true);
    form.controls.fields.removeAt(0);
    form.controls.fields.push(newField);
    applyServerErrors(
      form,
      {
        'AddFields[0].Label': ['new error'],
        'Fields[0].Choices[0].Label': ['old choice'],
        'Fields[0].AddChoices[0].Label': ['new choice'],
      },
      aliases(),
    );
    expect(newField.controls.label.errors?.['server']).toEqual(['new error']);
    expect(oldChoice.controls.label.errors?.['server']).toEqual(['old choice']);
    expect(newChoice.controls.label.errors?.['server']).toEqual(['new choice']);
    expect(existing.controls.label.errors?.['server']).toBeUndefined();
    form.controls.fields.removeAt(1);
    expect(applyServerErrors(form, { 'AddFields[0].Label': ['removed'] }, aliases())).toHaveLength(
      1,
    );
  });
});
