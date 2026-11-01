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
import { adminHomeGuard, overviewGuard, permissionGuard } from './permission.guard';

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
            can: (functionCode: string, actionCode: string) =>
              granted().includes(`Permissions.${functionCode}.${actionCode}`),
            restore: () => of(true),
            isCentralAdmin: () => false,
          },
        },
      ],
    });
  }
  it('denies missing grants and a direct create URL even when list access exists', () => {
    granted.set(['Permissions.Category.View']);
    configure();
    const denied = TestBed.runInInjectionContext(() =>
      permissionGuard(
        Object.assign(new ActivatedRouteSnapshot(), {
          data: { permission: { functionCode: 'Category', actionCode: 'Create' } },
        }),
        {} as RouterStateSnapshot,
      ),
    );
    expect(String(denied)).toBe('/admin/forbidden');
    const allowed = TestBed.runInInjectionContext(() =>
      permissionGuard(
        Object.assign(new ActivatedRouteSnapshot(), {
          data: { permission: { functionCode: 'Category', actionCode: 'View' } },
        }),
        {} as RouterStateSnapshot,
      ),
    );
    expect(allowed).toBe(true);
  });
  it('chooses the first permitted list, updates the menu after grants change and handles no access', async () => {
    granted.set(['Permissions.Category.View']);
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

  it('opens overview from either a domain permission or finance alone and revokes navigation with the grant', async () => {
    granted.set(['Permissions.FinancialSummary.View']);
    configure();
    const guard = () =>
      TestBed.runInInjectionContext(() =>
        overviewGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );
    expect(guard()).toBe(true);
    const result = TestBed.runInInjectionContext(() =>
      adminHomeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    if (isObservable(result)) expect(String(await firstValueFrom(result))).toBe('/admin/overview');
    granted.set(['Permissions.Inventory.View']);
    expect(guard()).toBe(true);
    granted.set(['Permissions.Product.View']);
    expect(String(guard())).toBe('/admin/forbidden');
    const fallback = TestBed.runInInjectionContext(() =>
      adminHomeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    if (isObservable(fallback))
      expect(String(await firstValueFrom(fallback))).toBe('/admin/collections/products');
  });

  it('supports an OR route requirement and fails closed for malformed or empty alternatives', () => {
    granted.set(['Permissions.Renewal.View']);
    configure();
    const check = (permission: unknown) =>
      TestBed.runInInjectionContext(() =>
        permissionGuard(
          Object.assign(new ActivatedRouteSnapshot(), { data: { permission } }),
          {} as RouterStateSnapshot,
        ),
      );
    expect(
      check({
        anyOf: [
          { functionCode: 'Order', actionCode: 'View' },
          { functionCode: 'Renewal', actionCode: 'View' },
        ],
      }),
    ).toBe(true);
    expect(String(check({ anyOf: [] }))).toBe('/admin/forbidden');
    expect(String(check({ anyOf: [{ functionCode: 'Renewal', actionCode: 'View' }, {}] }))).toBe(
      '/admin/forbidden',
    );
  });
});
