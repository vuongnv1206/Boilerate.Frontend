import { AuthSession } from '@core/auth/auth-session';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { ProductsService } from '@services/products.service';
import { ProductStatus } from '@enums/product.enum';
import { ProductPage } from '@models/product.dto';
import { ProductsStore } from '@stores/products.store';

describe('ProductsStore', () => {
  const first: ProductPage = { items: [], total: 40, pageNumber: 1, pageSize: 10 };
  const service = { search: vi.fn(), bulkStatus: vi.fn() };
  let store: ProductsStore;

  beforeEach(() => {
    service.search.mockReset().mockReturnValue(of(first));
    service.bulkStatus.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: { can: () => true } },
        ProductsStore,
        { provide: ProductsService, useValue: service },
      ],
    });
    store = TestBed.inject(ProductsStore);
  });

  it('cancels a stale search when the filter changes', () => {
    const slow = new Subject<ProductPage>();
    service.search.mockReturnValueOnce(slow).mockReturnValueOnce(of({ ...first, total: 3 }));
    store.load();
    expect(slow.observed).toBe(true);
    store.applyQuery({ q: '', status: ProductStatus.Published, page: 1, pageSize: 10 });
    expect(slow.observed).toBe(false);
    expect(store.page().total).toBe(3);
    expect(store.loading()).toBe(false);
    expect(service.search).toHaveBeenLastCalledWith({ pageNumber: 1, pageSize: 10, status: 2 });
  });

  it('applies parsed URL query and keeps one-based pagination', () => {
    store.applyQuery({ q: 'ghế', status: null, page: 1, pageSize: 10 });
    expect(service.search).toHaveBeenLastCalledWith({ pageNumber: 1, pageSize: 10, search: 'ghế' });
    store.applyQuery({ q: 'ghế', status: null, page: 2, pageSize: 10 });
    expect(service.search).toHaveBeenLastCalledWith({ pageNumber: 2, pageSize: 10, search: 'ghế' });
  });

  it('shows read errors and retries without changing the query', () => {
    service.search.mockReturnValueOnce(throwError(() => new Error('offline')));
    store.load();
    expect(store.error()).toContain('Không thể tải');
    expect(store.loading()).toBe(false);
    store.load();
    expect(store.error()).toBe('');
    expect(store.page().total).toBe(40);
  });

  it('unsubscribes outstanding reads when the page scope is destroyed', () => {
    const pending = new Subject<ProductPage>();
    service.search.mockReturnValue(pending);
    store.load();
    TestBed.resetTestingModule();
    expect(pending.observed).toBe(false);
  });

  it('retries the requested first page after a search fails on a later page', () => {
    service.search.mockReturnValueOnce(of({ ...first, pageNumber: 3 }));
    store.load();
    service.search.mockReturnValueOnce(throwError(() => new Error('offline')));
    store.applyQuery({ q: 'ghế', status: null, page: 1, pageSize: 10 });
    expect(store.page().pageNumber).toBe(3);
    store.load();
    expect(service.search).toHaveBeenLastCalledWith({ pageNumber: 1, pageSize: 10, search: 'ghế' });
  });

  it('sends all server filters and keeps zero price and unavailable stock', () => {
    store.applyQuery({
      q: '',
      status: null,
      page: 1,
      pageSize: 20,
      categoryId: 'cat',
      productTypeId: 'type',
      fulfillmentKind: 2,
      inStock: false,
      minimumPrice: 0,
      maximumPrice: 50000,
      sortBy: 'price',
      sortDirection: 'asc',
    });
    expect(service.search).toHaveBeenLastCalledWith({
      pageNumber: 1,
      pageSize: 20,
      categoryId: 'cat',
      productTypeId: 'type',
      fulfillmentKind: 2,
      inStock: false,
      minimumPrice: 0,
      maximumPrice: 50000,
      sortBy: 'price',
      sortDirection: 'asc',
    });
  });

  it('keeps selection on failed bulk and prevents duplicate submissions', () => {
    service.search.mockReturnValue(
      of({
        ...first,
        items: [
          {
            id: 'one',
            version: 'v1',
            name: 'Áo',
            slug: 'ao',
            status: 1,
            fromPrice: 100,
            inStock: true,
            fulfillmentKind: 1,
          },
        ],
      }),
    );
    store.load();
    store.toggle('one');
    const pending = new Subject<unknown>();
    service.bulkStatus.mockReturnValue(pending);
    store.changeSelectedStatus(ProductStatus.Published).subscribe();
    store.changeSelectedStatus(ProductStatus.Published).subscribe();
    expect(service.bulkStatus).toHaveBeenCalledOnce();
    expect(service.bulkStatus).toHaveBeenCalledWith({
      items: [{ id: 'one', version: 'v1' }],
      status: 2,
    });
    expect(store.selectedIds().has('one')).toBe(true);
    pending.error(new Error('offline'));
    expect(store.selectedIds().has('one')).toBe(true);
    expect(store.bulkBusy()).toBe(false);
    expect(store.error()).toContain('kiểm tra kết quả');
  });
});
