import { EnvironmentInjector, createEnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { firstValueFrom, isObservable, of } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthSession } from '@core/auth/auth-session';
import { WORKSPACE_NAVIGATION } from '@core/navigation/workspace-navigation';
import { provideWorkspaceNavigation } from '@app/app.providers';
import { CATALOG_PERMISSIONS } from '@constants/permission.constants';
import { adminHomeGuard, permissionGuard } from './permission.guard';

describe('Route and navigation permissions', () => {
  afterEach(() => TestBed.resetTestingModule());
  const granted = signal<readonly string[]>([]);
  function configure(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthSession,
          useValue: {
            hasPermission: (permission: string) => granted().includes(permission),
            restore: () => of(true),
          },
        },
      ],
    });
  }
  it('denies missing grants and a direct create URL even when list access exists', () => {
    granted.set([CATALOG_PERMISSIONS.category.view]);
    configure();
    const denied = TestBed.runInInjectionContext(() =>
      permissionGuard(
        Object.assign(new ActivatedRouteSnapshot(), {
          data: { permission: CATALOG_PERMISSIONS.category.create },
        }),
        {} as RouterStateSnapshot,
      ),
    );
    expect(String(denied)).toBe('/admin/forbidden');
    const allowed = TestBed.runInInjectionContext(() =>
      permissionGuard(
        Object.assign(new ActivatedRouteSnapshot(), {
          data: { permission: CATALOG_PERMISSIONS.category.view },
        }),
        {} as RouterStateSnapshot,
      ),
    );
    expect(allowed).toBe(true);
  });
  it('chooses the first permitted list, updates the menu after grants change and handles no access', async () => {
    granted.set([CATALOG_PERMISSIONS.category.view]);
    configure();
    const child = createEnvironmentInjector(
      provideWorkspaceNavigation(),
      TestBed.inject(EnvironmentInjector),
    );
    try {
      expect(
        child
          .get(WORKSPACE_NAVIGATION)
          .collections()
          .map((link) => link.key),
      ).toEqual(['categories']);
      const result = TestBed.runInInjectionContext(() =>
        adminHomeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );
      expect(isObservable(result)).toBe(true);
      if (isObservable(result))
        expect(String(await firstValueFrom(result))).toBe('/admin/collections/categories');
      granted.set([]);
      expect(child.get(WORKSPACE_NAVIGATION).collections()).toEqual([]);
      const empty = TestBed.runInInjectionContext(() =>
        adminHomeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );
      if (isObservable(empty))
        expect(
          TestBed.inject(Router).serializeUrl(
            (await firstValueFrom(empty)) as ReturnType<Router['createUrlTree']>,
          ),
        ).toBe('/admin/forbidden');
    } finally {
      child.destroy();
    }
  });
});
