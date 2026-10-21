import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideRuntimeConfig } from '@core/config/runtime-config.token';
import { ProductTypesService } from '@services/product-types.service';

describe('ProductTypesService API contract', () => {
  let service: ProductTypesService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRuntimeConfig({ apiBaseUrl: '/api' }),
        provideHttpClient(),
        provideHttpClientTesting(),
        ProductTypesService,
      ],
    });
    service = TestBed.inject(ProductTypesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });
  it('loads list and detail from the two supported endpoints', () => {
    service.getAll().subscribe();
    const list = http.expectOne('/api/product-types');
    expect(list.request.method).toBe('GET');
    list.flush([]);
    service.getById('type-1').subscribe();
    const detail = http.expectOne('/api/product-types/type-1');
    expect(detail.request.method).toBe('GET');
    detail.flush({ id: 'type-1' });
  });
  it('creates a type with fields and sends the version plus schema edits on update', () => {
    const create = { code: 'CLOTHING', name: 'Quần áo', fields: [] };
    service.create(create).subscribe();
    const post = http.expectOne('/api/product-types');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(create);
    post.flush({ ...create, id: 'type-1', version: 'v1' });
    const edit = {
      id: 'type-1',
      version: 'v1',
      name: 'Áo',
      isActive: true,
      addFields: [],
      fields: [],
    };
    service.update('type-1', edit).subscribe();
    const put = http.expectOne('/api/product-types/type-1');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual(edit);
    put.flush({ ...edit, version: 'v2' });
  });
});
