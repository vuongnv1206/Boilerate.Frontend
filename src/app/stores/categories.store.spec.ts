import { AuthSession } from '@core/auth/auth-session';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoriesService } from '@services/categories.service';
import { CategoryDto } from '@models/category.dto';
import { CategoriesStore } from '@stores/categories.store';

describe('CategoriesStore', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('filters a real response and removes a record only after the server confirms deletion', () => {
    const category: CategoryDto = {
      id: 'one',
      version: 'v1',
      name: 'Áo sơ mi',
      slug: 'ao-so-mi',
      description: null,
      parentId: null,
      sortOrder: 0,
      isActive: true,
    };
    const service = {
      getAll: vi.fn(() => of([category])),
      summaries: vi.fn(() => of([{ id: 'one', productCount: 3 }])),
      delete: vi.fn(() => of(false)),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: { can: () => true } },
        CategoriesStore,
        { provide: CategoriesService, useValue: service },
      ],
    });
    const store = TestBed.inject(CategoriesStore);
    const done = vi.fn();
    store.load();
    expect(store.productCount('one')).toBe(3);
    store.applyQuery({ q: 'sơ mi', page: 1 });
    expect(store.rows()).toEqual([category]);
    store.delete(category).subscribe((deleted) => {
      if (deleted) done();
    });
    expect(store.items()).toHaveLength(1);
    expect(done).not.toHaveBeenCalled();
    service.delete.mockReturnValue(of(true));
    store.delete(category).subscribe((deleted) => {
      if (deleted) done();
    });
    expect(store.items()).toHaveLength(0);
    expect(store.page()).toBe(1);
    expect(done).toHaveBeenCalledOnce();
    expect(service.delete).toHaveBeenLastCalledWith('one', 'v1');
    vi.spyOn(TestBed.inject(AuthSession), 'can').mockReturnValue(false);
    const readonlyStore = TestBed.runInInjectionContext(() => new CategoriesStore());
    readonlyStore.delete(category).subscribe();
    expect(service.delete).toHaveBeenCalledTimes(2);
  });
});
