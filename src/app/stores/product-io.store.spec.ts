import { AuthSession } from '@core/auth/auth-session';
import { createProductForm } from '@forms/product.form';
import {
  createOptionForm,
  createOptionValueForm,
  createSkuRow,
} from '@forms/product-commerce.form';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { ApiError } from '@core/http/api-error';
import { ProductsService } from '@services/products.service';
import { ProductFulfillmentKind, ProductStatus } from '@enums/product.enum';
import { ProductFieldType } from '@enums/product-field-type.enum';
import { ProductTypeLookup } from '@models/product-lookups.dto';
import { ProductDto, SaveProductEditor } from '@models/product.dto';
import { ProductIoStore } from '@stores/product-io.store';

describe('ProductIoStore', () => {
  const schema: ProductTypeLookup = {
    id: 'type-1',
    code: 'FURNITURE',
    name: 'Nội thất',
    isActive: true,
    version: 'type-version-1',
    fields: [],
  };
  const item: ProductDto = {
    id: 'product-1',
    productTypeId: schema.id,
    name: 'Ghế',
    slug: 'ghe',
    description: 'Mô tả',
    status: ProductStatus.Draft,
    version: 'product-version-1',
    categoryIds: ['category-1'],
    options: [],
    variants: [
      {
        id: 'variant-1',
        sku: 'SKU-1',
        combinationKey: 'DEFAULT',
        price: 120000,
        compareAtPrice: null,
        currency: 'VND',
        isDefault: true,
        isActive: true,
        imageMediaId: null,
        inStock: true,
        selections: [],
      },
    ],
    fields: [],
    media: [{ mediaAssetId: 'image-1', sortOrder: 0, altText: 'Ảnh ghế' }],
    fulfillmentKind: ProductFulfillmentKind.Physical,
  };
  const service = {
    get: vi.fn(),
    categories: vi.fn(),
    productTypes: vi.fn(),
    productType: vi.fn(),
    create: vi.fn(),
    saveEditor: vi.fn(),
    changeStatus: vi.fn(),
  };
  let store: ProductIoStore;

  beforeEach(() => {
    Object.values(service).forEach((method) => method.mockReset());
    service.get.mockReturnValue(of(item));
    service.categories.mockReturnValue(
      of([{ id: 'category-1', name: 'Nội thất', isActive: true }]),
    );
    service.productTypes.mockReturnValue(of([schema]));
    service.productType.mockReturnValue(of(schema));
    service.saveEditor.mockReturnValue(of({ ...item, version: 'product-version-2' }));
    service.create.mockReturnValue(of(item));
    service.changeStatus.mockReturnValue(
      of({ ...item, status: ProductStatus.Published, version: 'product-version-3' }),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: { can: () => true } },
        ProductIoStore,
        { provide: ProductsService, useValue: service },
      ],
    });
    store = TestBed.inject(ProductIoStore);
    store.setForm(createProductForm());
  });

  function changeName(name = 'Ghế mới'): void {
    store.form.markAsDirty();
    store.form.controls.name.setValue(name);
  }

  it('locks a view-only product and blocks direct save and status commands', () => {
    vi.spyOn(TestBed.inject(AuthSession), 'can').mockImplementation(
      (_functionCode, actionCode) => actionCode === 'View',
    );
    store.load(item.id);
    expect(store.form.disabled).toBe(true);
    store.save().subscribe();
    store.changeStatus(ProductStatus.Published);
    expect(service.saveEditor).not.toHaveBeenCalled();
    expect(service.changeStatus).not.toHaveBeenCalled();
  });

  it('loads typed detail and saves content with both concurrency versions, preserving media', () => {
    store.load(item.id);
    changeName();
    expect(service.saveEditor).not.toHaveBeenCalled();
    store.save().subscribe();
    expect(service.saveEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        version: item.version,
        productTypeVersion: schema.version,
        content: {
          name: 'Ghế mới',
          slug: 'ghe',
          description: 'Mô tả',
          categoryIds: ['category-1'],
          fields: [],
          media: item.media,
        },
        optionEdits: [],
        addedOptions: [],
        variantEdits: [
          {
            variantId: 'variant-1',
            price: 120000,
            compareAtPrice: null,
            isActive: true,
            imageMediaId: 'image-1',
          },
        ],
        addedVariants: [],
        defaultVariantSku: 'SKU-1',
        configuration: expect.objectContaining({
          defaultVariantId: 'variant-1',
          options: [],
          variants: [expect.objectContaining({ id: 'variant-1', imageMediaId: 'image-1' })],
        }),
      }),
    );
    expect(store.item()?.version).toBe('product-version-2');
    expect(store.form.pristine).toBe(true);
    expect(store.form.controls.sku.disabled).toBe(true);
    expect(store.hasUnsavedChanges()).toBe(false);
  });

  it('creates a real default SKU and generates a Vietnamese slug only until manually edited', () => {
    store.load(null);
    changeName('Đèn bàn');
    expect(store.form.controls.slug.value).toBe('den-ban');
    store.form.controls.slug.setValue('duong-dan-rieng');
    store.form.controls.name.setValue('Đèn đọc sách');
    store.form.controls.sku.setValue('DEN-01');
    store.form.controls.price.setValue(450000);
    const created = vi.fn();
    store.save().subscribe((saved) => {
      if (!store.form.dirty) created(saved.id);
    });
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        productTypeId: schema.id,
        productTypeVersion: schema.version,
        fulfillmentKind: 1,
        content: expect.objectContaining({ name: 'Đèn đọc sách', slug: 'duong-dan-rieng' }),
        options: [],
        variants: [{ sku: 'DEN-01', price: 450000, compareAtPrice: null, options: {} }],
      }),
    );
    expect(created).toHaveBeenCalledWith(item.id);
  });

  it('keeps dirty input and concurrency version after a 409 instead of auto retrying', () => {
    store.load(item.id);
    changeName('Tên đang nhập');
    service.saveEditor.mockReturnValue(
      throwError(
        () => new ApiError({ status: 409, kind: 'conflict', message: 'conflict', fieldErrors: {} }),
      ),
    );
    store.save().subscribe();
    expect(store.error()).toContain('đã thay đổi');
    expect(store.form.controls.name.value).toBe('Tên đang nhập');
    expect(store.form.dirty).toBe(true);
    expect(store.item()?.version).toBe(item.version);
    expect(service.saveEditor).toHaveBeenCalledTimes(1);
    expect(store.busy()).toBe(false);
  });

  it('opens the saved product after newer input from a pending create is saved', () => {
    const pending = new Subject<ProductDto>();
    service.create.mockReturnValue(pending);
    store.load(null);
    changeName('Sản phẩm mới');
    store.form.controls.sku.setValue('NEW-01');
    const created = vi.fn();
    store.save().subscribe((saved) => {
      if (!store.form.dirty) created(saved.id);
    });
    changeName('Nội dung mới hơn');
    pending.next(item);
    pending.complete();

    expect(created).not.toHaveBeenCalled();
    expect(store.form.controls.name.value).toBe('Nội dung mới hơn');
    expect(store.form.dirty).toBe(true);

    store.save().subscribe((saved) => {
      if (!store.form.dirty) created(saved.id);
    });

    expect(service.create).toHaveBeenCalledTimes(1);
    expect(service.saveEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        content: expect.objectContaining({ name: 'Nội dung mới hơn' }),
      }),
    );
    expect(store.form.pristine).toBe(true);
    expect(created).toHaveBeenCalledExactlyOnceWith(item.id);
  });

  it('maps server content validation back to the form and retains unsaved values', () => {
    store.load(item.id);
    changeName('Tên đang nhập');
    service.saveEditor.mockReturnValue(
      throwError(
        () =>
          new ApiError({
            status: 400,
            kind: 'validation',
            message: 'Invalid',
            fieldErrors: { 'Content.Name': ['Tên không hợp lệ'] },
          }),
      ),
    );
    store.save().subscribe();
    expect(store.form.controls.name.errors?.['server']).toEqual(['Tên không hợp lệ']);
    expect(store.form.controls.name.value).toBe('Tên đang nhập');
    expect(store.hasUnsavedChanges()).toBe(true);
  });

  it('blocks duplicate submissions and does not erase edits made while a save is pending', () => {
    const pending = new Subject<ProductDto>();
    service.saveEditor.mockReturnValue(pending);
    store.load(item.id);
    changeName('Phiên bản gửi');
    store.save().subscribe();
    store.save().subscribe();
    expect(service.saveEditor).toHaveBeenCalledTimes(1);
    changeName('Thay đổi mới hơn');
    pending.next({ ...item, name: 'Phiên bản gửi', version: 'new-version' });
    expect(store.form.controls.name.value).toBe('Thay đổi mới hơn');
    expect(store.form.dirty).toBe(true);
    expect(store.item()?.version).toBe('new-version');
  });

  it('rebases option and variant IDs when newer input is kept during a pending save', () => {
    const originalVariant = item.variants[0];
    if (!originalVariant) throw new Error('Expected the base product variant.');
    const redVariant = { ...originalVariant, inventoryVersion: 'stock-red-v1', quantity: 2 };
    const variant = (
      id: string,
      sku: string,
      isDefault: boolean,
      optionSelections: ProductDto['variants'][number]['selections'],
      inventoryVersion: string,
    ): ProductDto['variants'][number] => ({
      ...redVariant,
      id,
      sku,
      combinationKey: id,
      isDefault,
      selections: optionSelections,
      inventoryVersion,
    });
    const savedProduct: ProductDto = {
      ...item,
      version: 'product-version-2',
      options: [
        {
          id: 'option-color-server',
          code: 'OPTION_COLOR_SERVER',
          name: 'Màu sắc',
          sortOrder: 0,
          values: [
            { id: 'value-red-server', code: 'VALUE_RED_SERVER', label: 'Đỏ', sortOrder: 0 },
            {
              id: 'value-blue-server',
              code: 'VALUE_BLUE_SERVER',
              label: 'Xanh',
              sortOrder: 1,
            },
          ],
        },
        {
          id: 'option-size-server',
          code: 'OPTION_SIZE_SERVER',
          name: 'Kích cỡ',
          sortOrder: 1,
          values: [
            { id: 'value-small-server', code: 'VALUE_SMALL_SERVER', label: 'S', sortOrder: 0 },
            { id: 'value-medium-server', code: 'VALUE_MEDIUM_SERVER', label: 'M', sortOrder: 1 },
          ],
        },
      ],
      variants: [
        {
          ...redVariant,
          selections: [
            { optionId: 'option-color-server', optionValueId: 'value-red-server' },
            { optionId: 'option-size-server', optionValueId: 'value-small-server' },
          ],
          inventoryVersion: 'stock-red-v2',
        },
        variant(
          'variant-red-medium',
          'SKU-RED-M',
          false,
          [
            { optionId: 'option-color-server', optionValueId: 'value-red-server' },
            { optionId: 'option-size-server', optionValueId: 'value-medium-server' },
          ],
          'stock-red-medium-v1',
        ),
        variant(
          'variant-blue-small',
          'SKU-BLUE-S',
          false,
          [
            { optionId: 'option-color-server', optionValueId: 'value-blue-server' },
            { optionId: 'option-size-server', optionValueId: 'value-small-server' },
          ],
          'stock-blue-small-v1',
        ),
        variant(
          'variant-blue-medium',
          'SKU-BLUE-M',
          true,
          [
            { optionId: 'option-color-server', optionValueId: 'value-blue-server' },
            { optionId: 'option-size-server', optionValueId: 'value-medium-server' },
          ],
          'stock-blue-medium-v1',
        ),
      ],
    };
    const pending = new Subject<ProductDto>();
    service.get.mockReturnValue(of(item));
    service.saveEditor.mockReturnValueOnce(pending).mockReturnValue(of(savedProduct));
    store.load(item.id);

    const color = createOptionForm();
    color.controls.name.setValue('Màu sắc');
    color.controls.values.push(createOptionValueForm('', 'Đỏ'));
    color.controls.values.push(createOptionValueForm('', 'Xanh'));
    const size = createOptionForm();
    size.controls.name.setValue('Kích cỡ');
    size.controls.values.push(createOptionValueForm('', 'S'));
    size.controls.values.push(createOptionValueForm('', 'M'));
    store.form.controls.options.push(color);
    store.form.controls.options.push(size);
    const colorCode = color.controls.code.value;
    const sizeCode = size.controls.code.value;
    const redCode = color.controls.values.at(0).controls.code.value;
    const blueCode = color.controls.values.at(1).controls.code.value;
    const smallCode = size.controls.values.at(0).controls.code.value;
    const mediumCode = size.controls.values.at(1).controls.code.value;
    const localSelection = (colorValue: string, sizeValue: string) => ({
      [colorCode]: colorValue,
      [sizeCode]: sizeValue,
    });
    const redRow = store.form.controls.variants.at(0);
    redRow.controls.options.setValue(localSelection(redCode, smallCode));
    redRow.controls.quantity.setValue(5);
    redRow.controls.inventoryVersion.setValue('stock-red-v1');
    const addedRows = [
      createSkuRow('SKU-RED-M', localSelection(redCode, mediumCode), 200000),
      createSkuRow('SKU-BLUE-S', localSelection(blueCode, smallCode), 200000),
      createSkuRow('SKU-BLUE-M', localSelection(blueCode, mediumCode), 200000),
    ];
    const defaultAddedRow = addedRows[2];
    if (!defaultAddedRow) throw new Error('Expected the default combination row.');
    for (const row of addedRows) store.form.controls.variants.push(row);
    store.form.controls.defaultVariantId.setValue(defaultAddedRow.controls.clientId.value);
    store.form.controls.defaultVariantSku.setValue('SKU-BLUE-M');
    store.form.controls.name.setValue('Tên đã gửi');
    store.save().subscribe();
    const firstSave = service.saveEditor.mock.calls[0]?.[0] as SaveProductEditor | undefined;
    const submittedInventoryOperationId = firstSave?.configuration?.variants.find(
      (variant) => variant.id === redRow.controls.id.value,
    )?.inventoryOperationId;
    if (!submittedInventoryOperationId)
      throw new Error('Expected the first save to include an inventory operation ID.');

    store.form.controls.name.setValue('Tên mới hơn');
    pending.next(savedProduct);
    pending.complete();

    expect(store.form.controls.name.value).toBe('Tên mới hơn');
    expect(color.controls.id.value).toBe('option-color-server');
    expect(color.controls.values.at(0).controls.id.value).toBe('value-red-server');
    expect(color.controls.values.at(1).controls.id.value).toBe('value-blue-server');
    expect(size.controls.id.value).toBe('option-size-server');
    expect(size.controls.values.at(0).controls.id.value).toBe('value-small-server');
    expect(size.controls.values.at(1).controls.id.value).toBe('value-medium-server');
    expect([color.controls.sortOrder.value, size.controls.sortOrder.value]).toEqual([0, 1]);
    expect(color.controls.values.controls.map((value) => value.controls.sortOrder.value)).toEqual([
      0, 1,
    ]);
    expect(size.controls.values.controls.map((value) => value.controls.sortOrder.value)).toEqual([
      0, 1,
    ]);
    expect(redRow.controls.id.value).toBe('variant-1');
    expect(addedRows.map((row) => row.controls.id.value)).toEqual([
      'variant-red-medium',
      'variant-blue-small',
      'variant-blue-medium',
    ]);
    expect(store.form.controls.defaultVariantId.value).toBe('variant-blue-medium');
    expect(defaultAddedRow.controls.inventoryVersion.value).toBe('stock-blue-medium-v1');
    expect(redRow.controls.inventoryVersion.value).toBe('stock-red-v2');
    expect(redRow.controls.inventoryOperationId.value).not.toBe(submittedInventoryOperationId);

    redRow.controls.quantity.setValue(6);
    store.save().subscribe();
    const nextSave = service.saveEditor.mock.calls[1]?.[0] as SaveProductEditor | undefined;
    if (!nextSave) throw new Error('Expected the follow-up editor save.');
    expect(nextSave.addedOptions).toEqual([]);
    expect(nextSave.optionEdits).toHaveLength(2);
    expect(nextSave.optionEdits.map((option) => option.sortOrder)).toEqual([0, 1]);
    expect(nextSave.optionEdits.map((option) => option.addValues)).toEqual([[], []]);
    expect(nextSave.optionEdits.map((option) => option.values.map((value) => value.id))).toEqual([
      ['value-red-server', 'value-blue-server'],
      ['value-small-server', 'value-medium-server'],
    ]);
    expect(
      nextSave.optionEdits.map((option) => option.values.map((value) => value.sortOrder)),
    ).toEqual([
      [0, 1],
      [0, 1],
    ]);
    expect(nextSave.addedVariants).toEqual([]);
    expect(nextSave.variantEdits.map((variant) => variant.variantId)).toEqual([
      'variant-1',
      'variant-red-medium',
      'variant-blue-small',
      'variant-blue-medium',
    ]);
    expect(nextSave.configuration?.defaultVariantId).toBe('variant-blue-medium');
    const nextRedVariant = nextSave.configuration?.variants.find(
      (variant) => variant.id === 'variant-1',
    );
    expect(nextRedVariant).toEqual(
      expect.objectContaining({
        quantity: 6,
        inventoryVersion: 'stock-red-v2',
      }),
    );
    expect(nextRedVariant?.inventoryOperationId).not.toBe(submittedInventoryOperationId);
  });

  it('cancels a previous detail load when navigation changes the record', () => {
    const old = new Subject<ProductDto>();
    service.get
      .mockReturnValueOnce(old)
      .mockReturnValueOnce(of({ ...item, id: 'product-2', name: 'Sản phẩm hai' }));
    store.load('product-1');
    store.load('product-2');
    expect(old.observed).toBe(false);
    expect(store.item()?.id).toBe('product-2');
    expect(store.form.controls.name.value).toBe('Sản phẩm hai');
  });

  it('uses the returned status record version and requires saving content before publication', () => {
    store.load(item.id);
    changeName();
    store.changeStatus(ProductStatus.Published);
    expect(service.changeStatus).not.toHaveBeenCalled();
    store.save().subscribe();
    store.changeStatus(ProductStatus.Published);
    expect(service.changeStatus).toHaveBeenCalledWith({
      id: item.id,
      version: 'product-version-2',
      status: 2,
    });
    expect(store.item()?.version).toBe('product-version-3');
    expect(store.item()?.status).toBe(ProductStatus.Published);
  });

  it('does not write an invalid form or when a required custom field is blank', () => {
    service.productType.mockReturnValue(
      of({
        ...schema,
        fields: [
          {
            id: 'material',
            code: 'MATERIAL',
            label: 'Chất liệu',
            dataType: ProductFieldType.Text,
            helpText: null,
            isRequired: true,
            isActive: true,
            sortOrder: 0,
            choices: [],
          },
        ],
      }),
    );
    store.load(null);
    changeName();
    store.form.controls.sku.setValue('SKU');
    store.form.controls.fields.controls['material']?.setValue('   ');
    store.save().subscribe();
    expect(service.create).not.toHaveBeenCalled();
    expect(store.form.controls.fields.controls['material']?.hasError('required')).toBe(true);
  });

  it('unsubscribes editor requests on destroy', () => {
    const pending = new Subject<ProductDto>();
    service.get.mockReturnValue(pending);
    store.load(item.id);
    TestBed.resetTestingModule();
    expect(pending.observed).toBe(false);
  });
  it('maps a dynamic field from its submitted index to its id and summarizes unknown errors', () => {
    const definition = {
      id: 'field-number',
      code: 'WEIGHT',
      label: 'Trọng lượng',
      dataType: ProductFieldType.Number,
      isActive: true,
      isRequired: false,
      isFilterable: false,
      sortOrder: 0,
      helpText: null,
      choices: [],
    };
    service.productType.mockReturnValue(of({ ...schema, fields: [definition] }));
    store.load(item.id);
    store.form.controls.fields.controls['field-number']?.setValue(0);
    changeName();
    service.saveEditor.mockReturnValue(
      throwError(
        () =>
          new ApiError({
            status: 422,
            kind: 'validation',
            message: 'Invalid',
            fieldErrors: {
              'Content.Fields[0].NumberValue': ['Giá trị không hợp lệ'],
              Unrecognized: ['Cần kiểm tra dữ liệu liên quan'],
            },
          }),
      ),
    );
    store.save().subscribe();
    expect(store.form.controls.fields.controls['field-number']?.errors?.['server']).toEqual([
      'Giá trị không hợp lệ',
    ]);
    expect(store.summary()).toEqual(['Cần kiểm tra dữ liệu liên quan']);
    expect(store.form.controls.fields.controls['field-number']?.value).toBe(0);
    expect(store.form.dirty).toBe(true);
  });
  it('saves content and SKU prices in one versioned command and retains the draft on conflict reload', () => {
    store.load(item.id);
    changeName('Nội dung mới');
    store.form.controls.variants.at(0).controls.price.setValue(99000);
    service.saveEditor.mockReturnValue(
      throwError(
        () => new ApiError({ status: 409, kind: 'conflict', message: 'Conflict', fieldErrors: {} }),
      ),
    );
    store.save().subscribe();
    expect(service.saveEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ name: 'Nội dung mới' }),
        variantEdits: [expect.objectContaining({ variantId: 'variant-1', price: 99000 })],
        defaultVariantSku: 'SKU-1',
      }),
    );
    service.get.mockReturnValue(of({ ...item, name: 'Tên từ máy chủ', version: 'fresh-version' }));
    store.reloadCanonical();
    expect(store.item()?.version).toBe('fresh-version');
    expect(store.form.controls.name.value).toBe('Nội dung mới');
    expect(store.form.controls.variants.at(0).controls.price.value).toBe(99000);
    expect(store.form.dirty).toBe(true);
    service.saveEditor.mockReturnValue(of({ ...item, version: 'saved-version' }));
    store.save().subscribe();
    expect(service.saveEditor).toHaveBeenLastCalledWith(
      expect.objectContaining({ version: 'fresh-version' }),
    );
  });

  it('rebases untouched custom fields while preserving only edited field drafts', () => {
    const fields = [
      {
        id: 'field-edited',
        code: 'EDITED',
        label: 'Trường đã sửa',
        dataType: ProductFieldType.Text,
        helpText: null,
        isRequired: false,
        isFilterable: false,
        isActive: true,
        sortOrder: 0,
        choices: [],
      },
      {
        id: 'field-untouched',
        code: 'UNTOUCHED',
        label: 'Trường chưa sửa',
        dataType: ProductFieldType.Text,
        helpText: null,
        isRequired: false,
        isFilterable: false,
        isActive: true,
        sortOrder: 1,
        choices: [],
      },
    ];
    const original: ProductDto = {
      ...item,
      fields: fields.map((field) => ({
        fieldDefinitionId: field.id,
        fieldType: ProductFieldType.Text,
        textValue: `old-${field.code.toLowerCase()}`,
        label: field.label,
        choiceLabel: null,
      })),
    };
    service.get.mockReturnValueOnce(of(original));
    service.productType.mockReturnValue(of({ ...schema, fields }));
    store.load(item.id);
    const edited = store.form.controls.fields.controls['field-edited'];
    edited?.setValue('local draft');
    edited?.markAsDirty();
    changeName('Name draft');
    service.saveEditor.mockReturnValue(
      throwError(
        () => new ApiError({ status: 409, kind: 'conflict', message: 'Conflict', fieldErrors: {} }),
      ),
    );
    store.save().subscribe();

    const canonical: ProductDto = {
      ...original,
      version: 'fresh-version',
      fields: fields.map((field) => ({
        fieldDefinitionId: field.id,
        fieldType: ProductFieldType.Text,
        textValue: `remote-${field.code.toLowerCase()}`,
        label: field.label,
        choiceLabel: null,
      })),
    };
    service.get.mockReturnValueOnce(of(canonical));
    service.productType.mockReturnValueOnce(of({ ...schema, version: 'type-version-2', fields }));
    store.reloadCanonical();

    expect(store.form.controls.fields.controls['field-edited']?.value).toBe('local draft');
    expect(store.form.controls.fields.controls['field-untouched']?.value).toBe('remote-untouched');
    expect(store.item()?.version).toBe('fresh-version');

    const latest: ProductDto = {
      ...canonical,
      version: 'latest-version',
      fields: fields.map((field) => ({
        fieldDefinitionId: field.id,
        fieldType: ProductFieldType.Text,
        textValue: `latest-${field.code.toLowerCase()}`,
        label: field.label,
        choiceLabel: null,
      })),
    };
    service.get.mockReturnValueOnce(of(latest));
    service.productType.mockReturnValueOnce(of({ ...schema, version: 'type-version-3', fields }));
    store.save().subscribe();
    store.reloadCanonical();

    expect(store.form.controls.fields.controls['field-edited']?.value).toBe('local draft');
    expect(store.form.controls.fields.controls['field-untouched']?.value).toBe('latest-untouched');
    expect(store.item()?.version).toBe('latest-version');
  });

  it('duplicates content and image links into a new draft with fresh SKU identities and no stock calls', () => {
    store.load(null, item.id);
    expect(store.item()).toBeNull();
    expect(store.form.controls.slug.value).toBe('ghe-copy');
    expect(store.form.controls.sku.value).toBe('SKU-1-COPY');
    expect(store.form.controls.variants.at(0).controls.id.value).toBe('');
    expect(store.form.controls.media.getRawValue()).toEqual(item.media);
    expect(store.form.dirty).toBe(true);
    store.save().subscribe();
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ name: 'Ghế (bản sao)', media: item.media }),
        variants: [expect.objectContaining({ sku: 'SKU-1-COPY' })],
      }),
    );
    expect(service.saveEditor).not.toHaveBeenCalled();
  });

  it('keeps canonical prices and strips new prices when Price.Update is absent', () => {
    vi.spyOn(store, 'canPrice').mockReturnValue(false);
    store.load(item.id);
    changeName();
    store.form.controls.variants.at(0).controls.price.setValue(1);
    store.save().subscribe();
    expect(service.saveEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        variantEdits: [expect.objectContaining({ price: 120000 })],
      }),
    );
  });
  it('clears copied prices visibly when duplicating without Price.Update', () => {
    vi.spyOn(store, 'canPrice').mockReturnValue(false);
    store.load(null, item.id);
    expect(store.form.controls.price.value).toBeNull();
    expect(store.form.controls.variants.at(0).controls.price.value).toBeNull();
    expect(store.form.controls.variants.at(0).controls.compareAtPrice.value).toBeNull();
    expect(store.notice()).toContain('Giá không được sao chép');
  });
});
