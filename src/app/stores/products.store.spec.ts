import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { ProductsService } from '@services/products.service';
import { ProductStatus } from '@enums/product.enum';
import { ProductPage } from '@models/product.model';
import { ProductsStore } from '@stores/products.store';

describe('ProductsStore', () => {
  const first: ProductPage = { items: [], total: 40, pageNumber: 1, pageSize: 10 };
  const service = { search: vi.fn() };
  let store: ProductsStore;

  beforeEach(() => {
    service.search.mockReset().mockReturnValue(of(first));
    TestBed.configureTestingModule({
      providers: [ProductsStore, { provide: ProductsService, useValue: service }],
    });
    store = TestBed.inject(ProductsStore);
  });
  afterEach(() => vi.useRealTimers());

  it('cancels a stale search when the filter changes', () => {
    const slow = new Subject<ProductPage>();
    service.search.mockReturnValueOnce(slow).mockReturnValueOnce(of({ ...first, total: 3 }));
    store.load();
    expect(slow.observed).toBe(true);
    store.setStatus(ProductStatus.Published);
    expect(slow.observed).toBe(false);
    expect(store.page().total).toBe(3);
    expect(store.loading()).toBe(false);
    expect(service.search).toHaveBeenLastCalledWith({ pageNumber: 1, pageSize: 10, status: 2 });
  });

  it('debounces typing and retains one-based server pagination', () => {
    vi.useFakeTimers();
    store.load();
    store.setQuery('g');
    store.setQuery('ghế');
    vi.advanceTimersByTime(249);
    expect(service.search).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(service.search).toHaveBeenLastCalledWith({ pageNumber: 1, pageSize: 10, search: 'ghế' });
    store.setPage(2);
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
    vi.useFakeTimers();
    service.search.mockReturnValueOnce(of({ ...first, pageNumber: 3 }));
    store.load();
    service.search.mockReturnValueOnce(throwError(() => new Error('offline')));
    store.setQuery('ghế');
    vi.advanceTimersByTime(250);
    expect(store.page().pageNumber).toBe(3);
    store.load();
    expect(service.search).toHaveBeenLastCalledWith({ pageNumber: 1, pageSize: 10, search: 'ghế' });
  });
});
