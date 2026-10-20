import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideRuntimeConfig } from '../core/config/runtime-config.token';
import { CategoriesService } from '@services/categories.service';
import { SaveCategoryRequest } from '@models/category.dto';

describe('CategoriesService API contract', () => {
  let service: CategoriesService;
  let http: HttpTestingController;
  const request: SaveCategoryRequest = {
    id: null,
    version: null,
    name: 'Danh mục',
    slug: 'danh-muc',
    description: null,
    parentId: null,
    sortOrder: 0,
    isActive: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRuntimeConfig({ apiBaseUrl: '/api' }),
        provideHttpClient(),
        provideHttpClientTesting(),
        CategoriesService,
      ],
    });
    service = TestBed.inject(CategoriesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('uses the collection endpoint, without inventing a GET category detail endpoint', () => {
    service.getAll().subscribe((categories) => expect(categories).toEqual([]));
    const pending = http.expectOne('/api/categories');
    expect(pending.request.method).toBe('GET');
    pending.flush([]);
  });
  it('sends the nullable create identity and preserves the optimistic concurrency token on edit', () => {
    service.create(request).subscribe();
    const create = http.expectOne('/api/categories');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(request);
    create.flush({ ...request, id: 'category-1', version: 'v1' });
    const edit = { ...request, id: 'category-1', version: 'v1', name: 'Tên mới' };
    service.update('category-1', edit).subscribe();
    const update = http.expectOne('/api/categories/category-1');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body.version).toBe('v1');
    update.flush({ ...edit, version: 'v2' });
  });
  it('encodes the version query parameter when deleting', () => {
    service
      .delete('category-1', 'version+/= token')
      .subscribe((deleted) => expect(deleted).toBe(true));
    const pending = http.expectOne((value) => value.url === '/api/categories/category-1');
    expect(pending.request.method).toBe('DELETE');
    expect(pending.request.params.get('version')).toBe('version+/= token');
    pending.flush(true);
  });
});
