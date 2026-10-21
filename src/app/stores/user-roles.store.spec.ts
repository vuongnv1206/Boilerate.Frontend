import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error';
import { SystemAdministrationService } from '@services/system-administration.service';
import { UserRolesStore } from './user-roles.store';

describe('User role assignment', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('loads user version before assignments and preserves the selection on a protected-admin conflict', () => {
    const user = {
      id: 'user',
      version: 'user-v1',
      userName: 'Admin',
      firstName: '',
      lastName: '',
      email: '',
      isActive: true,
    };
    const service = {
      user: vi.fn(() => of(user)),
      userRoles: vi.fn(() =>
        of([{ roleId: 'admin', roleName: 'Admin', description: '', enabled: true }]),
      ),
      saveUserRoles: vi.fn(() =>
        throwError(
          () =>
            new ApiError({ status: 409, kind: 'conflict', message: 'Conflict', fieldErrors: {} }),
        ),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        UserRolesStore,
        { provide: SystemAdministrationService, useValue: service },
        {
          provide: AuthSession,
          useValue: {
            can: () => true,
            isCentralAdmin: () => true,
            authorizationChanged: () => of(undefined),
          },
        },
      ],
    });
    const store = TestBed.inject(UserRolesStore);
    store.load('user');
    store.toggle('admin', false);
    store.save().subscribe();
    expect(service.saveUserRoles).toHaveBeenCalledWith('user', 'user-v1', []);
    expect(store.dirty()).toBe(true);
    expect(store.error()).toBe('Conflict');
    expect(store.saving()).toBe(false);
  });
});
