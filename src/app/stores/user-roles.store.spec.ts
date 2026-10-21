import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Subject, of, throwError } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error';
import { createUserForm } from '@forms/system.form';
import { SystemUserDto } from '@models/system.dto';
import { SystemAdministrationService } from '@services/system-administration.service';
import { UserRolesStore } from './user-roles.store';

const original: SystemUserDto = {
  id: 'user',
  version: 'user-v1',
  userName: 'worker',
  firstName: 'Nhân viên',
  lastName: 'Nội dung',
  email: 'worker@example.test',
  phoneNumber: '0900000001',
  imageUrl: null,
  emailConfirmed: true,
  isActive: true,
};

function setup(permissions = ['Create', 'Update'], centralAdmin = true) {
  const service = {
    user: vi.fn(() => of(original)),
    userRoles: vi.fn(() =>
      of([{ roleId: 'editor', roleName: 'Editor', description: '', enabled: true }]),
    ),
    saveUserRoles: vi.fn(() => of('Saved roles.')),
    createUser: vi.fn(() => of('User worker Registered.')),
    updateUser: vi.fn(() => of(undefined)),
    toggleUserStatus: vi.fn(() => of(undefined)),
    requestUserPasswordReset: vi.fn(() => of('Request accepted.')),
  };
  TestBed.configureTestingModule({
    providers: [
      UserRolesStore,
      { provide: SystemAdministrationService, useValue: service },
      {
        provide: AuthSession,
        useValue: {
          can: (_functionCode: string, action: string) => permissions.includes(action),
          isCentralAdmin: () => centralAdmin,
          authorizationChanged: () => of(undefined),
        },
      },
    ],
  });
  const store = TestBed.inject(UserRolesStore);
  const form = createUserForm();
  store.setForm(form);
  return { store, form, service };
}

function failure(status: number, fieldErrors: Record<string, string[]> = {}): ApiError {
  return new ApiError({
    status,
    kind: status === 409 ? 'conflict' : 'validation',
    message: 'Rejected',
    fieldErrors,
  });
}

describe('User administration', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('submits creation once, clears the completed draft and removes initial passwords', () => {
    const { store, form, service } = setup();
    const response = new Subject<string>();
    service.createUser.mockReturnValue(response);
    store.load('new');
    form.markAsDirty();
    form.setValue({
      firstName: '  Nhân viên ',
      lastName: ' Mới ',
      email: 'new@example.test',
      userName: 'new-worker',
      password: 'InitialPassword!234',
      confirmPassword: 'InitialPassword!234',
      phoneNumber: ' ',
      deleteCurrentImage: false,
    });
    const save = store.saveProfile();
    expect(service.createUser).not.toHaveBeenCalled();
    save.subscribe();
    save.subscribe();
    expect(service.createUser).toHaveBeenCalledTimes(1);
    expect(service.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Nhân viên', lastName: 'Mới', phoneNumber: null }),
    );
    response.next('User new-worker Registered.\nCheck email.');
    response.complete();
    expect(store.created()).toBe(true);
    expect(store.dirty()).toBe(false);
    expect(form.controls.password.value).toBe('');
    expect(form.controls.confirmPassword.value).toBe('');
    expect(form.disabled).toBe(true);
    expect(store.notice()).toBe('User new-worker Registered. Check email.');
    store.saveProfile().subscribe();
    expect(service.createUser).toHaveBeenCalledTimes(1);
  });

  it('keeps creation input and maps server field errors so the user can correct and retry', () => {
    const { store, form, service } = setup();
    store.load('new');
    form.markAsDirty();
    form.patchValue({
      firstName: 'Nhân viên',
      lastName: 'Mới',
      email: 'new@example.test',
      userName: 'new-worker',
      password: 'InitialPassword!234',
      confirmPassword: 'InitialPassword!234',
    });
    service.createUser.mockReturnValueOnce(
      throwError(() => failure(400, { UserName: ['Tên đăng nhập đã tồn tại.'] })),
    );
    store.saveProfile().subscribe();
    expect(store.created()).toBe(false);
    expect(store.dirty()).toBe(true);
    expect(form.controls.userName.errors?.['server']).toEqual(['Tên đăng nhập đã tồn tại.']);
    expect(form.controls.password.value).toBe('InitialPassword!234');
    form.controls.userName.setValue('another-worker');
    store.saveProfile().subscribe();
    expect(service.createUser).toHaveBeenCalledTimes(2);
    expect(store.created()).toBe(true);
  });

  it('preserves profile and image drafts on conflict and does not read over them', () => {
    const { store, form, service } = setup();
    store.load('user');
    form.markAsDirty();
    form.controls.firstName.setValue('Tên đang chỉnh sửa');
    form.controls.phoneNumber.setValue('');
    const image = new File(['image'], 'avatar.png', { type: 'image/png' });
    store.setImage(image);
    service.updateUser.mockReturnValueOnce(throwError(() => failure(409)));
    store.saveProfile().subscribe();
    expect(service.updateUser).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({
        version: 'user-v1',
        firstName: 'Tên đang chỉnh sửa',
        phoneNumber: null,
        image,
      }),
    );
    expect(service.user).toHaveBeenCalledTimes(1);
    expect(form.controls.firstName.value).toBe('Tên đang chỉnh sửa');
    expect(store.image()).toBe(image);
    expect(store.dirty()).toBe(true);
    expect(store.error()).toContain('tải lại để đối chiếu');
    expect(store.saving()).toBe(false);
  });

  it('keeps later input while saving and uses the returned version on the next save', () => {
    const { store, form, service } = setup();
    const response = new Subject<undefined>();
    service.updateUser.mockReturnValueOnce(response);
    store.load('user');
    form.markAsDirty();
    form.controls.firstName.setValue('Đã gửi');
    store.saveProfile().subscribe();
    form.controls.firstName.setValue('Nhập tiếp');
    service.user.mockReturnValue(of({ ...original, firstName: 'Đã gửi', version: 'user-v2' }));
    response.next(undefined);
    response.complete();
    expect(form.controls.firstName.value).toBe('Nhập tiếp');
    expect(store.dirty()).toBe(true);
    expect(store.notice()).toContain('Thay đổi mới');
    store.saveProfile().subscribe();
    expect(service.updateUser).toHaveBeenLastCalledWith(
      'user',
      expect.objectContaining({ version: 'user-v2', firstName: 'Nhập tiếp' }),
    );
  });

  it('saves roles with the canonical version and preserves profile input', () => {
    const { store, form, service } = setup();
    store.load('user');
    form.markAsDirty();
    form.controls.firstName.setValue('Hồ sơ chưa lưu');
    store.toggle('editor', false);
    service.user.mockReturnValue(of({ ...original, version: 'user-v2' }));
    store.saveRoles().subscribe();
    expect(service.saveUserRoles).toHaveBeenCalledWith('user', 'user-v1', []);
    expect(store.rolesDirty()).toBe(false);
    expect(form.controls.firstName.value).toBe('Hồ sơ chưa lưu');
    expect(store.profileDirty()).toBe(true);
    store.saveProfile().subscribe();
    expect(service.updateUser).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({ version: 'user-v2' }),
    );
  });

  it('keeps the chosen roles on a protected-admin conflict', () => {
    const { store, service } = setup();
    store.load('user');
    store.toggle('editor', false);
    service.saveUserRoles.mockReturnValueOnce(throwError(() => failure(409)));
    store.saveRoles().subscribe();
    expect(store.rolesDirty()).toBe(true);
    expect(store.selected().has('editor')).toBe(false);
    expect(store.record()?.version).toBe('user-v1');
    expect(store.saving()).toBe(false);
  });

  it('changes account status without discarding independent profile and role drafts', () => {
    const { store, form, service } = setup();
    store.load('user');
    form.markAsDirty();
    form.controls.firstName.setValue('Hồ sơ chưa lưu');
    store.toggle('editor', false);
    service.user.mockReturnValue(of({ ...original, isActive: false, version: 'user-v2' }));
    store.toggleStatus().subscribe();
    expect(service.toggleUserStatus).toHaveBeenCalledWith('user', 'user-v1', false);
    expect(store.record()?.isActive).toBe(false);
    expect(form.controls.firstName.value).toBe('Hồ sơ chưa lưu');
    expect(store.profileDirty()).toBe(true);
    expect(store.rolesDirty()).toBe(true);
    expect(store.record()?.version).toBe('user-v2');
  });

  it('requests reset only for a confirmed address and keeps existing drafts', () => {
    const { store, form, service } = setup();
    service.user.mockReturnValueOnce(of({ ...original, emailConfirmed: false }));
    store.load('user');
    store.requestPasswordReset().subscribe();
    expect(service.requestUserPasswordReset).not.toHaveBeenCalled();
    store.load('user');
    form.markAsDirty();
    form.controls.firstName.setValue('Hồ sơ chưa lưu');
    store.requestPasswordReset().subscribe();
    expect(service.requestUserPasswordReset).toHaveBeenCalledWith('user');
    expect(form.controls.firstName.value).toBe('Hồ sơ chưa lưu');
    expect(store.dirty()).toBe(true);
    expect(store.notice()).toBe('Đã yêu cầu gửi liên kết đặt lại mật khẩu.');
  });

  it.each([
    { permissions: [], centralAdmin: true },
    { permissions: ['Create', 'Update'], centralAdmin: false },
  ])(
    'blocks every write without both the central-admin policy and action grant: %j',
    ({ permissions, centralAdmin }) => {
      const { store, form, service } = setup(permissions, centralAdmin);
      store.load('user');
      store.toggle('editor', false);
      store.saveProfile().subscribe();
      store.saveRoles().subscribe();
      store.toggleStatus().subscribe();
      store.requestPasswordReset().subscribe();
      expect(form.disabled).toBe(true);
      expect(store.selected().has('editor')).toBe(true);
      expect(service.updateUser).not.toHaveBeenCalled();
      expect(service.saveUserRoles).not.toHaveBeenCalled();
      expect(service.toggleUserStatus).not.toHaveBeenCalled();
      expect(service.requestUserPasswordReset).not.toHaveBeenCalled();
      store.load('new');
      store.saveProfile().subscribe();
      expect(service.createUser).not.toHaveBeenCalled();
    },
  );

  it('cancels a pending mutation when loading a different user and ignores its late result', () => {
    const { store, form, service } = setup();
    const response = new Subject<undefined>();
    service.updateUser.mockReturnValueOnce(response);
    store.load('user');
    form.markAsDirty();
    form.controls.firstName.setValue('Hồ sơ trước');
    store.saveProfile().subscribe();
    service.user.mockReturnValue(of({ ...original, id: 'other', firstName: 'Người khác' }));
    store.load('other');
    response.next(undefined);
    response.complete();
    expect(store.record()?.id).toBe('other');
    expect(form.controls.firstName.value).toBe('Người khác');
    expect(store.notice()).toBe('');
    expect(store.saving()).toBe(false);
  });
});
