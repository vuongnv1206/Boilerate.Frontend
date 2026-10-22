import { ProductFulfillmentKind, ProductStatus } from '@enums/product.enum';
import { ProductFieldType } from '@enums/product-field-type.enum';
import { ProductTypeLookup } from '@models/product-lookups.dto';
import { ProductDto } from '@models/product.dto';
import {
  configureProductFields,
  createProductForm,
  initializeProductForm,
  toProductContent,
  productConfiguration,
} from '@forms/product.form';

describe('Product form Catalog mapping', () => {
  const schema: ProductTypeLookup = {
    id: 'type-1',
    code: 'TEST',
    name: 'Loại sản phẩm',
    isActive: true,
    version: 'type-version',
    fields: [
      {
        id: 'bool',
        code: 'BOOLEAN',
        label: 'Có bảo hành',
        helpText: null,
        dataType: ProductFieldType.Boolean,
        isRequired: true,
        isActive: true,
        sortOrder: 0,
        choices: [],
      },
      {
        id: 'number',
        code: 'NUMBER',
        label: 'Khối lượng',
        helpText: null,
        dataType: ProductFieldType.Number,
        isRequired: false,
        isActive: true,
        sortOrder: 1,
        choices: [],
      },
      {
        id: 'old',
        code: 'OLD',
        label: 'Thuộc tính cũ',
        helpText: null,
        dataType: ProductFieldType.Text,
        isRequired: false,
        isActive: false,
        sortOrder: 2,
        choices: [],
      },
    ],
  };
  const item: ProductDto = {
    id: 'product-1',
    productTypeId: schema.id,
    name: 'Sản phẩm',
    slug: 'san-pham',
    description: null,
    status: ProductStatus.Draft,
    version: 'version',
    categoryIds: [],
    variants: [
      {
        id: 'variant-1',
        combinationKey: '',
        currency: 'VND',
        inStock: false,
        sku: '',
        price: 100,
        compareAtPrice: null,
        isActive: true,
        isDefault: true,
        imageMediaId: null,
        selections: [],
      },
    ],
    options: [],
    fields: [
      {
        fieldDefinitionId: 'old',
        fieldType: ProductFieldType.Text,
        label: 'Thuộc tính cũ',
        choiceLabel: null,
        textValue: 'Giữ nguyên',
      },
    ],
    media: [{ mediaAssetId: 'image-1', sortOrder: 0, altText: 'Ảnh cũ' }],
    fulfillmentKind: ProductFulfillmentKind.Physical,
  };

  it('preserves false, zero, inactive field values and media across content edits', () => {
    const form = createProductForm();
    initializeProductForm(form, item);
    configureProductFields(form, schema, item.fields);
    form.controls.fields.controls['number']?.setValue(0);
    const content = toProductContent(form, schema, item);
    expect(content.fields).toEqual([
      { fieldDefinitionId: 'bool', fieldType: 3, booleanValue: false },
      { fieldDefinitionId: 'number', fieldType: 2, numberValue: 0 },
      expect.objectContaining({ fieldDefinitionId: 'old', fieldType: 1, textValue: 'Giữ nguyên' }),
    ]);
    expect(form.controls.fields.controls['old']?.disabled).toBe(true);
    expect(content.media).toEqual(item.media);
    expect(form.controls.fields.valid).toBe(true);
  });

  it('enforces safe whole VND amounts and Catalog custom number precision', () => {
    const form = createProductForm();
    configureProductFields(form, schema);
    form.controls.price.setValue(0.5);
    expect(form.controls.price.invalid).toBe(true);
    form.controls.price.setValue(Number.MAX_SAFE_INTEGER + 1);
    expect(form.controls.price.invalid).toBe(true);
    form.controls.price.setValue(50000);
    expect(form.controls.price.valid).toBe(true);
    const number = form.controls.fields.controls['number'];
    number?.setValue(1.12345);
    expect(number?.invalid).toBe(true);
    number?.setValue(1.1234);
    expect(number?.valid).toBe(true);
  });
  it('keeps default identity with empty or duplicate SKUs and does not resurrect removed images', () => {
    const form = createProductForm();
    const initial = item.variants[0];
    if (!initial) throw new Error('Fixture requires a default variant');
    const duplicateSkus: ProductDto = {
      ...item,
      variants: [initial, { ...initial, id: 'variant-2', isDefault: false }],
    };
    initializeProductForm(form, duplicateSkus);
    const before = productConfiguration(form);
    expect(before.defaultVariantId).toBe('variant-1');
    expect(before.variants.map((variant) => variant.sku)).toEqual(['', '']);
    expect(before.variants[1]?.imageMediaId).toBeNull();
    form.controls.variants.at(0).controls.imageMediaId.setValue(null);
    expect(toProductContent(form, schema, duplicateSkus).media).toEqual([]);
  });
});
