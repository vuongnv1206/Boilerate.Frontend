import {
  createSkuRow,
  createVariantForm,
  generateSkuRows,
  nullableVndPrice,
} from '@forms/product-commerce.form';
import { FormControl } from '@angular/forms';

describe('SKU creation and VND rules', () => {
  const colorOption = {
    code: 'COLOR',
    name: 'Màu',
    values: [
      { code: 'RED', label: 'Đỏ' },
      { code: 'BLUE', label: 'Xanh' },
    ],
  };
  const options = [colorOption];
  it('keeps SKU and price edits while refreshing the unchanged combination and creates only new rows', () => {
    const existing = createSkuRow('CUSTOM-RED', { COLOR: 'RED' }, 50000);
    existing.controls.compareAtPrice.setValue(60000);
    const rows = generateSkuRows(options, 'SHIRT', 10000, [existing]);
    expect(rows[0]).toBe(existing);
    expect(rows[1]?.getRawValue()).toEqual({
      id: '',
      isActive: true,
      imageMediaId: null,
      sku: 'SHIRT-BLUE',
      price: 10000,
      compareAtPrice: null,
      options: { COLOR: 'BLUE' },
    });
  });
  it('rejects duplicate normalized identities and combinations above configured UI limits', () => {
    expect(() =>
      generateSkuRows([...options, { ...colorOption, code: 'color' }], 'A', null, []),
    ).toThrow();
    expect(() =>
      generateSkuRows(
        [
          {
            ...colorOption,
            values: [
              { code: 'RED', label: '1' },
              { code: 'red', label: '2' },
            ],
          },
        ],
        'A',
        null,
        [],
      ),
    ).toThrow();
    expect(() =>
      generateSkuRows(
        [
          {
            ...colorOption,
            values: Array.from({ length: 201 }, (_, index) => ({
              code: `V${index}`,
              label: `${index}`,
            })),
          },
        ],
        'A',
        null,
        [],
      ),
    ).toThrow();
  });
  it('accepts draft null and zero prices while enforcing whole safe VND and compare-at relation', () => {
    const price = new FormControl<number | null>(null, nullableVndPrice);
    expect(price.valid).toBe(true);
    price.setValue(0);
    expect(price.valid).toBe(true);
    price.setValue(0.1);
    expect(price.invalid).toBe(true);
    price.setValue(Number.MAX_SAFE_INTEGER + 1);
    expect(price.invalid).toBe(true);
    const form = createVariantForm();
    form.controls.sku.setValue('A');
    form.controls.price.setValue(100);
    form.controls.compareAtPrice.setValue(100);
    expect(form.hasError('comparePrice')).toBe(true);
    form.controls.compareAtPrice.setValue(101);
    expect(form.valid).toBe(true);
  });
});
