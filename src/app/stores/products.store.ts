import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import { ApiError } from '../core/http/api-error';
import { PRODUCT_PAGE_SIZES, PRODUCT_SEARCH_DELAY_MS } from '@constants/product.constants';
import { ProductsService } from '@services/products.service';
import { ProductStatus } from '@enums/product.enum';
import { ProductPage, ProductSearch } from '@models/product.model';

/** Page-owned search state. A changed request cancels the preceding read. */
@Injectable()
export class ProductsStore {
  private readonly service = inject(ProductsService);
  private readonly requests = new Subject<ProductSearch>();
  private readonly queries = new Subject<string>();
  private readonly pageState = signal<ProductPage>({
    items: [],
    total: 0,
    pageNumber: 1,
    pageSize: 10,
  });
  private readonly queryState = signal('');
  private readonly statusState = signal<ProductStatus | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal('');
  private readonly selectionState = signal<ReadonlySet<string>>(new Set());
  private requestedPage = 1;
  readonly page = this.pageState.asReadonly();
  readonly query = this.queryState.asReadonly();
  readonly status = this.statusState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly selectedIds = this.selectionState.asReadonly();
  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.page().total / this.page().pageSize)),
  );
  readonly rangeStart = computed(() =>
    this.page().items.length ? (this.page().pageNumber - 1) * this.page().pageSize + 1 : 0,
  );
  readonly rangeEnd = computed(() =>
    this.rangeStart() ? this.rangeStart() + this.page().items.length - 1 : 0,
  );
  readonly allSelected = computed(
    () =>
      this.page().items.length > 0 &&
      this.page().items.every((item) => this.selectedIds().has(item.id)),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.requests
      .pipe(
        switchMap((request) => {
          this.loadingState.set(true);
          this.errorState.set('');
          return this.service.search(request).pipe(
            catchError((error: unknown) => {
              this.errorState.set(
                error instanceof ApiError
                  ? error.message
                  : 'Không thể tải sản phẩm. Vui lòng thử lại.',
              );
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((page) => {
        this.loadingState.set(false);
        if (!page) return;
        this.pageState.set(page);
        this.selectionState.set(new Set());
      });
    this.queries
      .pipe(debounceTime(PRODUCT_SEARCH_DELAY_MS), takeUntilDestroyed(destroyRef))
      .subscribe(() => this.request(1));
    destroyRef.onDestroy(() => {
      this.requests.complete();
      this.queries.complete();
    });
  }

  load(): void {
    this.request(this.requestedPage);
  }

  setQuery(query: string): void {
    this.queryState.set(query);
    this.queries.next(query);
  }

  setStatus(status: ProductStatus | null): void {
    this.statusState.set(status);
    this.request(1);
  }

  setPage(page: number): void {
    if (!Number.isInteger(page) || page < 1 || page > this.pageCount()) return;
    this.request(page);
  }

  setPageSize(size: number): void {
    if (!PRODUCT_PAGE_SIZES.some((value) => value === size)) return;
    this.pageState.update((page) => ({ ...page, pageSize: size }));
    this.request(1);
  }

  toggle(id: string): void {
    if (!this.page().items.some((item) => item.id === id)) return;
    const selected = new Set(this.selectedIds());
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    this.selectionState.set(selected);
  }

  toggleAll(): void {
    this.selectionState.set(
      this.allSelected() ? new Set() : new Set(this.page().items.map((item) => item.id)),
    );
  }

  clearSelection(): void {
    this.selectionState.set(new Set());
  }

  resetFilters(): void {
    this.queryState.set('');
    this.statusState.set(null);
    this.request(1);
  }

  private request(pageNumber: number): void {
    this.requestedPage = pageNumber;
    const search = this.query().trim();
    const status = this.status();
    this.requests.next({
      pageNumber,
      pageSize: this.page().pageSize,
      ...(search ? { search } : {}),
      ...(status === null ? {} : { status }),
    });
  }
}
