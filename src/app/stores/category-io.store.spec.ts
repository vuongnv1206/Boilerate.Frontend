import { AuthSession } from '@core/auth/auth-session';
import { createCategoryForm } from '@forms/category.form';
import { TestBed } from '@angular/core/testing';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@core/http/api-error';
import { CategoriesService } from '@services/categories.service';
import { ProductsService } from '@services/products.service';
import { CategoryDto } from '@models/category.dto';
import { ProductSummary } from '@models/product.dto';
import { ProductFulfillmentKind, ProductStatus } from '@enums/product.enum';
import { CategoryIoStore } from '@stores/category-io.store';

describe('CategoryIoStore', () => {
  const category: CategoryDto = {
    id: 'parent',
    version: 'v1',
    name: 'Danh mục',
    slug: 'danh-muc',
    description: null,
    parentId: null,
    sortOrder: 0,
    isActive: true,
  };
  let service: {
    getAll: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    setProducts: ReturnType<typeof vi.fn>;
  };
  let productsService: { search: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
  const product = (id: string, version: string): ProductSummary => ({
    id,
    version,
    name: id,
    slug: id,
    status: ProductStatus.Draft,
    fromPrice: null,
    inStock: true,
    fulfillmentKind: ProductFulfillmentKind.Physical,
  });
  let store: CategoryIoStore;
  beforeEach(() => {
    service = {
      getAll: vi.fn(() => of([category])),
      create: vi.fn(),
      update: vi.fn(),
      setProducts: vi.fn(),
    };
    productsService = {
      search: vi.fn(() => of({ items: [], total: 0, pageNumber: 1, pageSize: 100 })),
      get: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: { can: () => true } },
        CategoryIoStore,
        { provide: CategoriesService, useValue: service },
        { provide: ProductsService, useValue: productsService },
      ],
    });
    store = TestBed.inject(CategoryIoStore);
    store.setForm(createCategoryForm());
  });
  afterEach(() => TestBed.resetTestingModule());

  it('excludes itself and all descendants from parent choices', () => {
    service.getAll.mockReturnValue(
      of([
        category,
        { ...category, id: 'child', parentId: 'parent' },
        { ...category, id: 'grandchild', parentId: 'child' },
        { ...category, id: 'unrelated' },
      ]),
    );
    store.load('parent');
    expect(store.parentOptions().map((item) => item.id)).toEqual(['unrelated']);
    expect(store.form.pristine).toBe(true);
  });
  it('does not allow an unknown edit id to become a create request', async () => {
    store.load('missing');
    expect(store.ready()).toBe(false);
    expect(store.error()).toContain('Không tìm thấy');
    store.form.patchValue({ name: 'Tên', slug: 'ten' });
    expect(await firstValueFrom(store.save(), { defaultValue: null })).toBeNull();
    expect(service.create).not.toHaveBeenCalled();
  });
  it('rejects whitespace names and noninteger sort order before calling the service', async () => {
    store.load('new');
    store.form.patchValue({ name: '  ', slug: 'valid', sortOrder: 1.5 });
    expect(await firstValueFrom(store.save(), { defaultValue: null })).toBeNull();
    expect(store.form.controls.name.touched).toBe(true);
    expect(service.create).not.toHaveBeenCalled();
  });
  it('keeps the user draft and maps server validation on conflict', async () => {
    const response = new Subject<CategoryDto>();
    service.update.mockReturnValue(response);
    store.load('parent');
    store.form.controls.name.setValue('Đang chỉnh');
    store.form.markAsDirty();
    const saving = firstValueFrom(store.save(), { defaultValue: null });
    response.error(
      new ApiError({
        kind: 'conflict',
        status: 409,
        message: 'Conflict',
        fieldErrors: { Name: ['Tên đã tồn tại'] },
      }),
    );
    expect(await saving).toBeNull();
    expect(store.form.controls.name.value).toBe('Đang chỉnh');
    expect(store.form.dirty).toBe(true);
    expect(store.form.controls.name.errors?.['server']).toEqual(['Tên đã tồn tại']);
    expect(store.record()?.version).toBe('v1');
    expect(store.error()).toContain('giữ lại');
  });
  it('prevents duplicate submits and keeps edits made during a pending request', async () => {
    const response = new Subject<CategoryDto>();
    service.update.mockReturnValue(response);
    store.load('parent');
    store.form.controls.name.setValue('Gửi đi');
    store.form.markAsDirty();
    const pending = firstValueFrom(store.save(), { defaultValue: null });
    expect(await firstValueFrom(store.save(), { defaultValue: null })).toBeNull();
    store.form.controls.name.setValue('Chỉnh tiếp');
    response.next({ ...category, name: 'Gửi đi', version: 'v2' });
    response.complete();
    await pending;
    expect(service.update).toHaveBeenCalledTimes(1);
    expect(store.record()?.version).toBe('v2');
    expect(store.form.controls.name.value).toBe('Chỉnh tiếp');
    expect(store.form.dirty).toBe(true);
  });
  it('cancels an older load when the route id changes', () => {
    const old = new Subject<readonly CategoryDto[]>();
    service.getAll
      .mockReturnValueOnce(old)
      .mockReturnValueOnce(of([{ ...category, id: 'second' }]));
    store.load('parent');
    store.load('second');
    old.next([category]);
    expect(store.record()?.id).toBe('second');
  });
  it('locks a view-only form and rejects a direct save without calling the service', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        CategoryIoStore,
        { provide: CategoriesService, useValue: service },
        { provide: ProductsService, useValue: productsService },
        {
          provide: AuthSession,
          useValue: { can: (_functionCode: string, actionCode: string) => actionCode === 'View' },
        },
      ],
    });
    const readonlyStore = TestBed.inject(CategoryIoStore);
    readonlyStore.setForm(createCategoryForm());
    readonlyStore.load('parent');
    expect(readonlyStore.form.disabled).toBe(true);
    readonlyStore.save().subscribe();
    expect(service.update).not.toHaveBeenCalled();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('rebases only the requested membership delta after metadata succeeds but the batch conflicts', async () => {
    let canonical = [product('a', 'a1')];
    productsService.search.mockImplementation(() =>
      of({
        items: canonical,
        total: canonical.length,
        pageNumber: 1,
        pageSize: 100,
      }),
    );
    productsService.get.mockImplementation((id: string) =>
      of({ version: id === 'a' ? 'a3' : 'b7' }),
    );
    service.update.mockReturnValue(of({ ...category, name: 'Tên mới', version: 'v2' }));
    service.setProducts
      .mockReturnValueOnce(
        throwError(
          () =>
            new ApiError({
              kind: 'conflict',
              status: 409,
              message: 'stale',
              fieldErrors: {},
            }),
        ),
      )
      .mockReturnValueOnce(
        of([
          { productId: 'a', version: 'a4', included: false },
          { productId: 'b', version: 'b8', included: true },
        ]),
      );
    store.load('parent');
    store.removeProduct('a');
    store.addProduct(product('b', 'b1'));
    store.form.controls.name.setValue('Tên mới');
    expect(await firstValueFrom(store.save(), { defaultValue: null })).toBeNull();
    expect(store.record()?.version).toBe('v2');
    expect(store.productError()).toContain('Danh mục đã lưu');
    canonical = [product('a', 'a2'), product('c', 'c5')];
    store.reconcileProducts();
    expect(store.selectedProducts().map((item) => item.id)).toEqual(['c', 'b']);
    expect(store.productIssues()).toHaveLength(0);
    expect(store.productsDirty()).toBe(true);
    expect(await firstValueFrom(store.save())).toMatchObject({ version: 'v2' });
    expect(service.update).toHaveBeenCalledTimes(1);
    expect(service.setProducts).toHaveBeenLastCalledWith('parent', [
      { productId: 'a', version: 'a3', included: false },
      { productId: 'b', version: 'b7', included: true },
    ]);
    expect(store.selectedProducts().map((item) => item.id)).toEqual(['c', 'b']);
  });

  it('blocks save for a deleted pending product until the user drops that intent', async () => {
    productsService.get.mockReturnValue(
      throwError(
        () =>
          new ApiError({
            kind: 'not-found',
            status: 404,
            message: 'missing',
            fieldErrors: {},
          }),
      ),
    );
    store.load('parent');
    store.addProduct(product('gone', 'old'));
    store.reconcileProducts();
    expect(store.productIssues()).toHaveLength(1);
    expect(await firstValueFrom(store.save(), { defaultValue: null })).toBeNull();
    expect(service.setProducts).not.toHaveBeenCalled();
    store.discardProductChange('gone');
    expect(store.productIssues()).toHaveLength(0);
    expect(store.productsDirty()).toBe(false);
  });

  it('cancels a pending membership batch before it can clear the next category draft', () => {
    const membership = new Subject<
      readonly { productId: string; version: string; included: boolean }[]
    >();
    service.setProducts.mockReturnValue(membership);
    service.getAll.mockReturnValue(of([category, { ...category, id: 'second' }]));
    store.load('parent');
    store.addProduct(product('a', 'a1'));
    store.save().subscribe();
    expect(store.saving()).toBe(true);
    store.load('second');
    store.addProduct(product('b', 'b1'));
    expect(store.productsDirty()).toBe(true);
    membership.next([{ productId: 'a', version: 'a2', included: true }]);
    membership.complete();
    expect(store.record()?.id).toBe('second');
    expect(store.selectedProducts().map((item) => item.id)).toEqual(['b']);
    expect(store.productsDirty()).toBe(true);
    expect(store.saving()).toBe(false);
    expect(store.productError()).toBe('');
  });

  it('retains a partially created copy and restores its pending links without creating another category', async () => {
    const member = product('a', 'a1');
    const copy = {
      ...category,
      id: 'copy',
      version: 'copy1',
      name: 'Danh mục copy',
      slug: 'danh-muc-copy',
    };
    productsService.search.mockReturnValueOnce(
      of({ items: [member], total: 1, pageNumber: 1, pageSize: 100 }),
    );
    service.create.mockReturnValue(of(copy));
    service.setProducts.mockReturnValue(
      throwError(
        () => new ApiError({ kind: 'conflict', status: 409, message: 'stale', fieldErrors: {} }),
      ),
    );
    store.load('parent');
    expect(await firstValueFrom(store.duplicate(), { defaultValue: null })).toBeNull();
    expect(store.partialCopy()?.id).toBe('copy');
    expect(await firstValueFrom(store.duplicate(), { defaultValue: null })).toBeNull();
    expect(service.create).toHaveBeenCalledTimes(1);
    service.getAll.mockReturnValue(of([category, copy]));
    store.load('copy');
    expect(store.record()?.id).toBe('copy');
    expect(store.selectedProducts().map((item) => item.id)).toEqual(['a']);
    expect(store.productReconcileRequired()).toBe(true);
    expect(await firstValueFrom(store.save(), { defaultValue: null })).toBeNull();
    productsService.get.mockReturnValue(of({ version: 'a2' }));
    store.reconcileProducts();
    expect(store.productReconcileRequired()).toBe(false);
    service.setProducts.mockReturnValue(of([{ productId: 'a', version: 'a3', included: true }]));
    expect(await firstValueFrom(store.save())).toMatchObject({ id: 'copy' });
    expect(service.create).toHaveBeenCalledTimes(1);
    expect(service.setProducts).toHaveBeenLastCalledWith('copy', [
      { productId: 'a', version: 'a2', included: true },
    ]);
  });

  it('allows Product.Update membership without Category.Update for an existing category', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        CategoryIoStore,
        { provide: CategoriesService, useValue: service },
        { provide: ProductsService, useValue: productsService },
        {
          provide: AuthSession,
          useValue: {
            can: (functionCode: string, actionCode: string) =>
              functionCode === 'Product' && (actionCode === 'View' || actionCode === 'Update'),
          },
        },
      ],
    });
    const membershipStore = TestBed.inject(CategoryIoStore);
    membershipStore.setForm(createCategoryForm());
    membershipStore.load('parent');
    expect(membershipStore.form.disabled).toBe(true);
    expect(membershipStore.canManageProducts()).toBe(true);
    membershipStore.addProduct(product('b', 'b1'));
    service.setProducts.mockReturnValue(of([{ productId: 'b', version: 'b2', included: true }]));
    expect(await firstValueFrom(membershipStore.save())).toMatchObject({ id: 'parent' });
    expect(service.update).not.toHaveBeenCalled();
    expect(service.setProducts).toHaveBeenCalledWith('parent', [
      { productId: 'b', version: 'b1', included: true },
    ]);
  });
});
