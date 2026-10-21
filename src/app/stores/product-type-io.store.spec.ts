import { AuthSession } from '@core/auth/auth-session';
import { createProductTypeForm } from '@forms/product-type.form';
import { TestBed } from '@angular/core/testing';
import { Subject, firstValueFrom, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@core/http/api-error';
import { ProductTypesService } from '@services/product-types.service';
import { ProductFieldType } from '@enums/product-field-type.enum';
import { ProductTypeDto } from '@models/product-type.dto';
import { ProductTypeIoStore } from '@stores/product-type-io.store';

describe('ProductTypeIoStore', () => {
  const productType: ProductTypeDto = {
    id: 'type-1',
    version: 'v1',
    code: 'SHIRT',
    name: 'Áo',
    isActive: true,
    fields: [
      {
        id: 'field-1',
        code: 'MATERIAL',
        dataType: ProductFieldType.Choice,
        label: 'Chất liệu',
        helpText: 'Hướng dẫn',
        isRequired: true,
        isFilterable: true,
        isActive: true,
        sortOrder: 2,
        choices: [
          { id: 'choice-1', code: 'COTTON', label: 'Cotton', isActive: false, sortOrder: 3 },
        ],
      },
    ],
  };
  let service: {
    getById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let store: ProductTypeIoStore;
  beforeEach(() => {
    service = { getById: vi.fn(() => of(productType)), create: vi.fn(), update: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: { can: () => true } },
        ProductTypeIoStore,
        { provide: ProductTypesService, useValue: service },
      ],
    });
    store = TestBed.inject(ProductTypeIoStore);
    store.setForm(createProductTypeForm());
  });
  afterEach(() => TestBed.resetTestingModule());

  it('locks a view-only type and rejects direct writes and schema changes', () => {
    vi.spyOn(TestBed.inject(AuthSession), 'can').mockImplementation(
      (_functionCode, actionCode) => actionCode === 'View',
    );
    store.load('type-1');
    expect(store.form.disabled).toBe(true);
    store.addField();
    store.addChoice(0);
    store.save().subscribe();
    expect(store.form.controls.fields.length).toBe(1);
    expect(store.form.controls.fields.at(0).controls.choices.length).toBe(1);
    expect(service.update).not.toHaveBeenCalled();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('creates a type with a correctly typed optional choice field', async () => {
    store.load('new');
    store.form.patchValue({ code: 'CLOTHING', name: 'Quần áo' });
    store.addField();
    const field = store.form.controls.fields.at(0);
    field.patchValue({ code: 'COLOR', label: 'Màu', dataType: ProductFieldType.Choice });
    store.addChoice(0);
    field.controls.choices.at(0).patchValue({ code: 'RED', label: 'Đỏ' });
    service.create.mockReturnValue(of({ ...productType, code: 'CLOTHING' }));
    expect(await firstValueFrom(store.save(), { defaultValue: null })).not.toBeNull();
    expect(service.create).toHaveBeenCalledWith({
      code: 'CLOTHING',
      name: 'Quần áo',
      fields: [
        {
          code: 'COLOR',
          dataType: 5,
          label: 'Màu',
          helpText: null,
          isRequired: false,
          isFilterable: false,
          choices: [{ code: 'RED', label: 'Đỏ' }],
        },
      ],
    });
    expect(store.form.pristine).toBe(true);
  });
  it('preserves ids, inactive choices and field metadata while editing the name', async () => {
    store.load('type-1');
    store.form.controls.name.setValue('Áo mới');
    store.form.markAsDirty();
    service.update.mockReturnValue(of({ ...productType, name: 'Áo mới', version: 'v2' }));
    await firstValueFrom(store.save(), { defaultValue: null });
    expect(service.update).toHaveBeenCalledWith('type-1', {
      id: 'type-1',
      version: 'v1',
      name: 'Áo mới',
      isActive: true,
      addFields: [],
      fields: [
        {
          id: 'field-1',
          label: 'Chất liệu',
          helpText: 'Hướng dẫn',
          isFilterable: true,
          isActive: true,
          sortOrder: 2,
          addChoices: [],
          choices: [{ id: 'choice-1', label: 'Cotton', isActive: false, sortOrder: 3 }],
        },
      ],
    });
    expect(store.record()?.version).toBe('v2');
  });
  it('adds only optional fields to an existing type and does not remove existing schema', async () => {
    store.load('type-1');
    store.removeNewField(0);
    expect(store.form.controls.fields.length).toBe(1);
    store.addField();
    store.form.controls.fields.at(1).patchValue({
      code: 'WEIGHT',
      label: 'Trọng lượng',
      dataType: ProductFieldType.Number,
      isRequired: true,
    });
    service.update.mockReturnValue(of(productType));
    await firstValueFrom(store.save(), { defaultValue: null });
    expect(service.update.mock.calls[0]?.[1].addFields).toEqual([
      {
        code: 'WEIGHT',
        dataType: 2,
        label: 'Trọng lượng',
        helpText: null,
        isRequired: false,
        isFilterable: false,
        choices: [],
      },
    ]);
  });
  it('rejects duplicate field codes before a request is made', async () => {
    store.load('new');
    store.form.patchValue({ code: 'SHIRT', name: 'Áo' });
    store.addField();
    store.addField();
    store.form.controls.fields.at(0).patchValue({ code: 'COLOR', label: 'Màu' });
    store.form.controls.fields.at(1).patchValue({ code: 'color', label: 'Màu khác' });
    expect(await firstValueFrom(store.save(), { defaultValue: null })).toBeNull();
    expect(store.form.controls.fields.hasError('duplicateCodes')).toBe(true);
    expect(service.create).not.toHaveBeenCalled();
  });
  it('keeps the draft and version after a conflict, without retrying a mutation', async () => {
    store.load('type-1');
    store.form.controls.name.setValue('Tên đang sửa');
    store.form.markAsDirty();
    const response = new Subject<ProductTypeDto>();
    service.update.mockReturnValue(response);
    const saving = firstValueFrom(store.save(), { defaultValue: null });
    response.error(
      new ApiError({ kind: 'conflict', status: 409, message: 'Conflict', fieldErrors: {} }),
    );
    expect(await saving).toBeNull();
    expect(store.form.controls.name.value).toBe('Tên đang sửa');
    expect(store.form.dirty).toBe(true);
    expect(store.record()?.version).toBe('v1');
    expect(service.update).toHaveBeenCalledTimes(1);
  });
  it('cancels a stale detail load when the user opens another record', () => {
    const response = new Subject<ProductTypeDto>();
    service.getById
      .mockReturnValueOnce(response)
      .mockReturnValueOnce(of({ ...productType, id: 'second' }));
    store.load('type-1');
    store.load('second');
    response.next(productType);
    expect(store.record()?.id).toBe('second');
    expect(store.ready()).toBe(true);
  });
  it('keeps edits made during save and reuses server-assigned field and choice ids on the next save', async () => {
    store.load('new');
    store.form.patchValue({ code: 'SHIRT', name: 'Áo' });
    store.addField();
    const field = store.form.controls.fields.at(0);
    field.patchValue({ code: 'MATERIAL', label: 'Chất liệu', dataType: ProductFieldType.Choice });
    store.addChoice(0);
    field.controls.choices.at(0).patchValue({ code: 'COTTON', label: 'Cotton' });
    const response = new Subject<ProductTypeDto>();
    service.create.mockReturnValue(response);
    const saving = firstValueFrom(store.save(), { defaultValue: null });
    store.form.controls.name.setValue('Tên vừa nhập');
    response.next(productType);
    response.complete();
    await saving;
    expect(store.form.controls.name.value).toBe('Tên vừa nhập');
    expect(store.form.dirty).toBe(true);
    expect(store.saved()).toBe(false);
    expect(field.controls.id.value).toBe('field-1');
    expect(field.controls.choices.at(0).controls.id.value).toBe('choice-1');
    service.update.mockReturnValue(of({ ...productType, version: 'v2' }));
    await firstValueFrom(store.save(), { defaultValue: null });
    expect(service.update.mock.calls[0]?.[1].addFields).toEqual([]);
    expect(service.update.mock.calls[0]?.[1].fields[0].addChoices).toEqual([]);
    expect(service.update.mock.calls[0]?.[1].fields[0].choices[0].id).toBe('choice-1');
  });
});
