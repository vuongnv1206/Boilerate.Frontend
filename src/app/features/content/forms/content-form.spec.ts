import { describe, expect, it } from 'vitest';
import { CONTENT_LIMITS, createContentDraft, isValidItem } from '../models/content-item';
import { createContentForm } from './content-form';

describe('Content form contract', () => {
  it('requires meaningful names and a valid slug for new content', () => {
    const form = createContentForm();
    form.patchValue({ name: '   ', slug: 'not a slug' });
    expect(form.controls.name.errors).toEqual({ required: true });
    expect(form.controls.slug.hasError('pattern')).toBe(true);
    form.patchValue({ name: 'Tên hợp lệ', slug: 'ten-hop-le' });
    expect(form.valid).toBe(true);
  });

  it.each(Object.entries(CONTENT_LIMITS))(
    'uses the same %s length limit as the data service',
    (key, limit) => {
      const form = createContentForm();
      const item = { ...createContentDraft('products'), name: 'Tên hợp lệ', slug: 'ten-hop-le' };
      const field = key as keyof typeof CONTENT_LIMITS;
      form.reset({ ...item, [field]: 'a'.repeat(limit) });
      expect(form.valid).toBe(true);
      expect(isValidItem({ ...item, ...form.getRawValue() })).toBe(true);
      form.controls[field].setValue('a'.repeat(limit + 1));
      expect(form.controls[field].hasError('maxlength')).toBe(true);
      expect(isValidItem({ ...item, ...form.getRawValue() })).toBe(false);
    },
  );

  it.each([
    { price: -1, stock: 0 },
    { price: Number.POSITIVE_INFINITY, stock: 0 },
    { price: Number.NaN, stock: 0 },
    { price: 0, stock: -1 },
    { price: 0, stock: 1.5 },
    { price: 0, stock: Number.NaN },
  ])('rejects invalid numeric content %j in the form and service', (values) => {
    const form = createContentForm();
    const item = {
      ...createContentDraft('products'),
      name: 'Tên hợp lệ',
      slug: 'ten-hop-le',
      ...values,
    };
    form.reset(item);
    expect(form.invalid).toBe(true);
    expect(isValidItem(item)).toBe(false);
  });
});
