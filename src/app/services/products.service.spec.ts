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

  it('uses the exact product SKU mutation and filtered stock contracts', () => {
    service
      .editVariant({
        productId: 'p1',
        variantId: 'v1',
        version: 'pv1',
        price: 0,
        compareAtPrice: null,
        isActive: true,
        imageMediaId: null,
      })
      .subscribe();
    const variant = http.expectOne('/api/products/p1/variants/v1');
    expect(variant.request.method).toBe('PUT');
    expect(variant.request.body.version).toBe('pv1');
    expect(variant.request.body.price).toBe(0);
    variant.flush({});
    service.inventory('p1', 2).subscribe();
    const inventory = http.expectOne('/api/inventory?productId=p1&page=2&size=100');
    expect(inventory.request.method).toBe('GET');
    inventory.flush({ items: [], total: 0, pageNumber: 2, pageSize: 100 });
    const adjustment = {
      inventoryItemId: 'i1',
      version: 'iv1',
      operationId: 'op1',
      delta: -2,
      reason: 'Kiểm kho',
    };
    service.adjustInventory(adjustment).subscribe();
    const movement = http.expectOne('/api/inventory/i1/adjustments');
    expect(movement.request.body).toEqual(adjustment);
    movement.flush({});
    service
      .importDigital('p1', 'v1', 'pv2', [{ reference: 'KEY-1', content: 'Secret' }])
      .subscribe();
    const digital = http.expectOne('/api/digital-inventory/variants/v1/items');
    expect(digital.request.body).toEqual({
      productId: 'p1',
      variantId: 'v1',
      version: 'pv2',
      items: [{ reference: 'KEY-1', content: 'Secret' }],
    });
    digital.flush([]);
  });
  it('submits one versioned catalog editor command and an atomic bulk status command', () => {
    const editor = {
      id: 'p1',
      version: 'pv1',
      productTypeVersion: 'tv1',
      content: {
        name: 'Sản phẩm',
        slug: 'san-pham',
        description: null,
        categoryIds: [],
        fields: [],
        media: [],
      },
      optionEdits: [],
      addedOptions: [],
      variantEdits: [],
      addedVariants: [],
      defaultVariantSku: 'SKU-1',
    };
    service.saveEditor(editor).subscribe();
    const save = http.expectOne('/api/products/p1/editor');
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual(editor);
    save.flush({});
    const bulk = { items: [{ id: 'p1', version: 'pv2' }], status: ProductStatus.Published };
    service.bulkStatus(bulk).subscribe();
    const status = http.expectOne('/api/products/bulk-status');
    expect(status.request.method).toBe('POST');
    expect(status.request.body).toEqual(bulk);
    status.flush({ items: [{ id: 'p1', status: ProductStatus.Published, version: 'pv3' }] });
  });
});
