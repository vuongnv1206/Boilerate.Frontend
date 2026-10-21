import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error';
import { createRoleForm } from '@forms/system.form';
import { ActionDto, FunctionDto } from '@models/system.dto';
import { SystemAdministrationService } from '@services/system-administration.service';
import { RoleIoStore } from './role-io.store';

const action = (id: string, code: string, isActive = true, selected = false): ActionDto => ({
  id,
  code,
  name: code,
  isActive,
  selected,
  version: 'a1',
});
const functions: readonly FunctionDto[] = [
  {
    id: 'products',
    groupId: 'catalog',
    code: 'Product',
    name: 'Sản phẩm',
    version: 'f1',
    isActive: true,
    actionDtos: [
      action('view', 'View'),
      action('publish', 'Publish'),
      action('retired', 'Retired', false, true),
    ],
  },
  {
    id: 'categories',
    groupId: 'catalog',
    code: 'Category',
    name: 'Danh mục',
    version: 'f2',
    isActive: true,
    actionDtos: [action('view', 'View', true, true), action('approve', 'Approve')],
  },
];
function configure(canWrite = true) {
  const role = { id: 'editor', name: 'Editor', description: '', version: 'r1' };
  const service = {
    role: vi.fn(() => of(role)),
    rolePermissions: vi.fn(() => of(functions)),
    groups: vi.fn(() =>
      of([{ id: 'catalog', code: 'Catalog', name: 'Catalog', sortOrder: 1, version: 'g1' }]),
    ),
    savePermissions: vi.fn(() => of('saved')),
    saveRole: vi.fn(() => of('editor')),
  };
  TestBed.configureTestingModule({
    providers: [
      RoleIoStore,
      { provide: SystemAdministrationService, useValue: service },
      {
        provide: AuthSession,
        useValue: {
          can: (_f: string, a: string) => canWrite || a === 'View',
          isCentralAdmin: () => true,
          authorizationChanged: () => of(undefined),
        },
      },
    ],
  });
  const store = TestBed.inject(RoleIoStore);
  const form = createRoleForm();
  store.setForm(form);
  store.load('editor');
  return { store, form, service };
}
describe('Role permission editor', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('renders actual pairs, counts valid pairs and applies bulk only to visible functions without adding View', () => {
    const { store, service } = configure();
    expect(store.groups()[0]?.total).toBe(4);
    expect(store.groups()[0]?.count).toBe(1);
    store.keyword.set('Product');
    const group = store.groups()[0];
    if (!group) throw new Error('Missing group');
    expect(group.actions.map((a) => a.code)).toEqual(['Publish', 'View']);
    store.toggleBulk(group.functions, 'publish', true);
    expect(store.checked('products', 'publish')).toBe(true);
    expect(store.checked('products', 'view')).toBe(false);
    store.keyword.set('');
    expect(store.bulkState(store.groups()[0]?.functions ?? [], 'view')).toBe('some');
    store.savePermissions().subscribe();
    expect(service.savePermissions).toHaveBeenCalledWith('editor', 'r1', [
      { functionId: 'products', actionId: 'publish' },
      { functionId: 'products', actionId: 'retired' },
      { functionId: 'categories', actionId: 'view' },
    ]);
  });
  it('keeps metadata and hidden choices dirty across a failed save and sends a retained inactive grant', () => {
    const { store, form, service } = configure();
    form.controls.description.setValue('Unsaved description');
    form.markAsDirty();
    store.toggle(functions[1] as FunctionDto, action('approve', 'Approve'), true);
    service.savePermissions.mockReturnValue(
      throwError(
        () => new ApiError({ status: 409, kind: 'conflict', message: 'Conflict', fieldErrors: {} }),
      ),
    );
    store.keyword.set('Product');
    store.savePermissions().subscribe();
    expect(store.error()).toBe('Conflict');
    expect(form.dirty).toBe(true);
    expect(store.permissionsDirty()).toBe(true);
    expect(store.checked('products', 'retired')).toBe(true);
    expect(store.checked('categories', 'approve')).toBe(true);
  });
  it('can remove an inactive grant, refuses a new inactive grant and rejects direct writes when read only', () => {
    const { store } = configure();
    const product = functions[0] as FunctionDto;
    store.toggle(product, action('retired', 'Retired', false, true), false);
    store.toggle(product, action('new-inactive', 'Other', false), true);
    expect(store.checked('products', 'retired')).toBe(false);
    expect(store.checked('products', 'new-inactive')).toBe(false);
    TestBed.resetTestingModule();
    const readonly = configure(false);
    readonly.store.toggle(product, action('publish', 'Publish'), true);
    readonly.store.savePermissions().subscribe();
    readonly.store.saveInfo().subscribe();
    expect(readonly.service.savePermissions).not.toHaveBeenCalled();
    expect(readonly.service.saveRole).not.toHaveBeenCalled();
    expect(readonly.form.disabled).toBe(true);
  });
});
