import { AuthSession } from '@core/auth/auth-session';
import { createCategoryForm } from '@forms/category.form';
import { TestBed } from '@angular/core/testing';
import { Subject, firstValueFrom, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@core/http/api-error';
import { CategoriesService } from '@services/categories.service';
import { CategoryDto } from '@models/category.dto';
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
  };
  let store: CategoryIoStore;
  beforeEach(() => {
    service = { getAll: vi.fn(() => of([category])), create: vi.fn(), update: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: { hasPermission: () => true } },
        CategoryIoStore,
        { provide: CategoriesService, useValue: service },
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
        {
          provide: AuthSession,
          useValue: { hasPermission: (permission: string) => permission.endsWith('.View') },
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
});
