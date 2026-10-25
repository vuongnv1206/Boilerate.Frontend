import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductFulfillmentKind, ProductStatus } from '@enums/product.enum';
import { ProductDto, ProductPage } from '@models/product.dto';
import { StorefrontService } from '@services/storefront.service';
import { StorefrontStore } from '@stores/storefront.store';

describe('StorefrontStore', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('loads categories and searches products', () => {
    const mockPage: ProductPage = {
      items: [
        {
          id: 'p-1',
          name: 'Windows 11 Pro',
          slug: 'windows-11-pro',
          status: ProductStatus.Published,
          fromPrice: 450000,
          inStock: true,
          fulfillmentKind: ProductFulfillmentKind.DigitalUnique,
        },
      ],
      total: 1,
      pageNumber: 1,
      pageSize: 20,
    };

    const service = {
      getCategories: vi.fn(() => of([{ id: 'c-1', name: 'Hệ điều hành', slug: 'os' }])),
      searchProducts: vi.fn(() => of(mockPage)),
      getProductBySlug: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [StorefrontStore, { provide: StorefrontService, useValue: service }],
    });

    const store = TestBed.inject(StorefrontStore);
    store.loadCategories();
    expect(store.categories()).toHaveLength(1);

    store.search({ search: 'Windows' });
    expect(service.searchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Windows' }),
    );
    expect(store.page().items).toHaveLength(1);
    expect(store.hasProducts()).toBe(true);
  });

  it('loads product detail by slug and updates variant on option selection', () => {
    const mockProduct: ProductDto = {
      id: 'p-1',
      name: 'Áo Polo',
      slug: 'ao-polo',
      productTypeId: 'pt-1',
      fulfillmentKind: ProductFulfillmentKind.Physical,
      status: ProductStatus.Published,
      description: 'Chất liệu thoáng mát',
      version: 'v1',
      categoryIds: [],
      fields: [],
      options: [
        {
          id: 'opt-color',
          code: 'color',
          name: 'Màu sắc',
          sortOrder: 0,
          values: [
            { id: 'val-blue', code: 'blue', label: 'Xanh', sortOrder: 0 },
            { id: 'val-red', code: 'red', label: 'Đỏ', sortOrder: 1 },
          ],
        },
      ],
      variants: [
        {
          id: 'var-blue',
          sku: 'POLO-BLUE',
          combinationKey: 'blue',
          price: 250000,
          compareAtPrice: 300000,
          currency: 'VND',
          isDefault: true,
          isActive: true,
          imageMediaId: null,
          inStock: true,
          selections: [{ optionId: 'opt-color', optionValueId: 'val-blue' }],
        },
        {
          id: 'var-red',
          sku: 'POLO-RED',
          combinationKey: 'red',
          price: 270000,
          compareAtPrice: null,
          currency: 'VND',
          isDefault: false,
          isActive: true,
          imageMediaId: null,
          inStock: false,
          selections: [{ optionId: 'opt-color', optionValueId: 'val-red' }],
        },
      ],
      media: [],
    };

    const service = {
      getCategories: vi.fn(() => of([])),
      searchProducts: vi.fn(),
      getProductBySlug: vi.fn(() => of(mockProduct)),
    };

    TestBed.configureTestingModule({
      providers: [StorefrontStore, { provide: StorefrontService, useValue: service }],
    });

    const store = TestBed.inject(StorefrontStore);
    store.loadProductBySlug('ao-polo');

    expect(store.productDetail()?.name).toBe('Áo Polo');
    expect(store.selectedVariant()?.sku).toBe('POLO-BLUE');

    store.selectOption('opt-color', 'val-red');
    expect(store.selectedVariant()?.sku).toBe('POLO-RED');
    expect(store.selectedVariant()?.inStock).toBe(false);
  });
});
