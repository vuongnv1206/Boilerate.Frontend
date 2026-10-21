import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '@core/config/runtime-config.token';
import { ProductStatus } from '@enums/product.enum';
import { ProductsService } from '@services/products.service';

describe('ProductsService Catalog wire contract', () => {
  let service: ProductsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api' } },
        ProductsService,
      ],
    });
    service = TestBed.inject(ProductsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('posts one-based Catalog pagination and numeric status without a demo collection key', () => {
    const result = vi.fn();
    service
      .search({ pageNumber: 2, pageSize: 10, search: 'Ghế', status: ProductStatus.Published })
      .subscribe(result);
    const request = http.expectOne('/api/products/search');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ pageNumber: 2, pageSize: 10, search: 'Ghế', status: 2 });
    const page = { items: [], total: 14, pageNumber: 2, pageSize: 10 };
    request.flush(page);
    expect(result).toHaveBeenCalledWith(page);
  });

  it('keeps content updates separate from SKU, inventory and status writes', () => {
    const content = {
      name: 'Ghế',
      slug: 'ghe',
      description: null,
      categoryIds: [],
      fields: [],
      media: [],
    };
    service
      .edit({ id: 'product-id', version: 'v1', productTypeVersion: 't1', content })
      .subscribe();
    const request = http.expectOne('/api/products/product-id');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      id: 'product-id',
      version: 'v1',
      productTypeVersion: 't1',
      content,
    });
    request.flush({});
    service
      .changeStatus({ id: 'product-id', version: 'v2', status: ProductStatus.Archived })
      .subscribe();
    const status = http.expectOne('/api/products/product-id/status');
    expect(status.request.method).toBe('POST');
    expect(status.request.body).toEqual({ id: 'product-id', version: 'v2', status: 3 });
    status.flush({});
  });

  it('reads product type versions and categories through explicit lookup endpoints', () => {
    service.categories().subscribe();
    service.productTypes().subscribe();
    service.productType('type-id').subscribe();
    service.get('product-id').subscribe();
    for (const url of [
      '/api/categories',
      '/api/product-types',
      '/api/product-types/type-id',
      '/api/products/product-id',
    ]) {
      const request = http.expectOne(url);
      expect(request.request.method).toBe('GET');
      request.flush(url === '/api/categories' || url === '/api/product-types' ? [] : {});
    }
  });
});
