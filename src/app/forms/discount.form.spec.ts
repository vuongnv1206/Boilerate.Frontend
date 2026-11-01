import { describe, expect, it } from 'vitest';
import { createDiscountForm, discountFormValue, discountRequest } from './discount.form';
import type { DiscountDto } from '@models/discount.dto';

describe('discount form', () => {
  it('converts Vietnamese wall time to UTC independently of the browser timezone', () => {
    const form = createDiscountForm();
    form.patchValue({
      code: 'hello10',
      name: '  Ưu đãi  ',
      value: 10,
      startsAt: '2026-11-02T08:30',
      endsAt: '2026-11-03T08:30',
    });
    expect(form.valid).toBe(true);
    const request = discountRequest(form);
    expect(request).toMatchObject({
      code: 'HELLO10',
      name: 'Ưu đãi',
      startsAtUtc: '2026-11-02T01:30:00.000Z',
      endsAtUtc: '2026-11-03T01:30:00.000Z',
    });
    const record: DiscountDto = { ...request, id: 'id', version: 'version', usedCount: 0 };
    expect(discountFormValue(record)).toMatchObject({
      startsAt: '2026-11-02T08:30:00',
      endsAt: '2026-11-03T08:30:00',
    });
  });

  it('rejects excessive percent, fractional money and an inverted validity period', () => {
    const form = createDiscountForm();
    form.patchValue({ code: 'SAVE', name: 'Ưu đãi', value: 100 });
    expect(form.hasError('percent')).toBe(true);
    form.patchValue({ value: 10, minimumSubtotal: 12.5 });
    expect(form.controls.minimumSubtotal.hasError('integer')).toBe(true);
    form.patchValue({
      minimumSubtotal: 0,
      startsAt: '2026-11-03T08:30',
      endsAt: '2026-11-02T08:30',
    });
    expect(form.hasError('dateRange')).toBe(true);
    form.patchValue({ endsAt: '2026-11-04T08:30', usageLimit: 0 });
    expect(form.controls.usageLimit.hasError('min')).toBe(true);
  });

  it('preserves the original precise dates when editing another field', () => {
    const record: DiscountDto = {
      id: 'id',
      code: 'SAVE',
      name: 'Ưu đãi',
      kind: 1,
      value: 10,
      minimumSubtotal: 0,
      startsAtUtc: '2026-11-02T01:30:00.1234567Z',
      endsAtUtc: '2026-11-03T01:30:00.7654321Z',
      usageLimit: null,
      usedCount: 0,
      isActive: true,
      version: 'version',
    };
    const form = createDiscountForm();
    form.reset(discountFormValue(record));
    form.controls.name.setValue('Tên mới');
    expect(discountRequest(form, record)).toMatchObject({
      startsAtUtc: record.startsAtUtc,
      endsAtUtc: record.endsAtUtc,
    });
    form.controls.startsAt.setValue('2026-11-02T09:30');
    expect(discountRequest(form, record).startsAtUtc).toBe('2026-11-02T02:30:00.000Z');
  });
});
