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
    const service = { getAll: vi.fn(() => of([category])), delete: vi.fn(() => of(false)) };
    TestBed.configureTestingModule({
      providers: [CategoriesStore, { provide: CategoriesService, useValue: service }],
    });
    const store = TestBed.inject(CategoriesStore);
    const done = vi.fn();
    store.load();
    store.search('sơ mi');
    expect(store.rows()).toEqual([category]);
    store.delete(category, done);
    expect(store.items()).toHaveLength(1);
    expect(done).not.toHaveBeenCalled();
    service.delete.mockReturnValue(of(true));
    store.delete(category, done);
    expect(store.items()).toHaveLength(0);
    expect(store.page()).toBe(1);
    expect(done).toHaveBeenCalledOnce();
    expect(service.delete).toHaveBeenLastCalledWith('one', 'v1');
  });
});
