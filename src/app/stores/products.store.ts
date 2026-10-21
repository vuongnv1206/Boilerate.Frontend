import { ProductListQuery } from '@models/list-query.model';
import { AuthSession } from '@core/auth/auth-session';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  defer,
  finalize,
  forkJoin,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { ApiError } from '@core/http/api-error';
import { ProductsService } from '@services/products.service';
import { ProductStatus } from '@enums/product.enum';
import { ProductPage, ProductSearch } from '@models/product.dto';
import { ProductCategoryLookup, ProductTypeLookup } from '@models/product-lookups.dto';

/** Page-owned search state. A changed request cancels the preceding read. */
@Injectable()
export class ProductsStore {
  private readonly session = inject(AuthSession);
  readonly canView = computed(() => this.session.can('Product', 'View'));
  readonly canCreate = computed(() => this.session.can('Product', 'Create'));
  readonly canPublish = computed(() => this.session.can('Product', 'Publish'));
  private readonly service = inject(ProductsService);
  private readonly requests = new Subject<ProductSearch>();
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
  private readonly bulkBusyState = signal(false);
  private readonly noticeState = signal('');
  private readonly categoriesState = signal<readonly ProductCategoryLookup[]>([]);
  private readonly typesState = signal<readonly ProductTypeLookup[]>([]);
  private readonly lookupErrorState = signal('');
  private readonly filtersState = signal<ProductListQuery>({
    q: '',
    status: null,
    page: 1,
    pageSize: 10,
  });
  private readonly destroyRef = inject(DestroyRef);
  private readonly selectionState = signal<ReadonlySet<string>>(new Set());
  private requestedPage = 1;
  private readonly correctionState = signal<number | null>(null);
  readonly queryCorrection = this.correctionState.asReadonly();
  readonly page = this.pageState.asReadonly();
  readonly query = this.queryState.asReadonly();
  readonly status = this.statusState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly bulkBusy = this.bulkBusyState.asReadonly();
  readonly notice = this.noticeState.asReadonly();
  readonly filters = this.filtersState.asReadonly();
  readonly categories = this.categoriesState.asReadonly();
  readonly types = this.typesState.asReadonly();
  readonly lookupError = this.lookupErrorState.asReadonly();
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
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        this.loadingState.set(false);
        if (!page) return;
        const lastPage = Math.max(1, Math.ceil(page.total / page.pageSize));
        if (this.requestedPage > lastPage) {
          this.correctionState.set(lastPage);
          return;
        }
        this.pageState.set(page);
        this.selectionState.set(new Set());
      });
    this.destroyRef.onDestroy(() => {
      this.requests.complete();
    });
  }

  applyQuery(query: ProductListQuery): void {
    this.filtersState.set(query);
    this.queryState.set(query.q);
    this.statusState.set(query.status);
    this.pageState.update((page) => ({ ...page, pageSize: query.pageSize }));
    this.correctionState.set(null);
    this.request(query.page);
  }

  load(): void {
    this.request(this.requestedPage);
  }

  loadLookups(): void {
    this.lookupErrorState.set('');
    forkJoin({
      categories: this.session.can('Category', 'View') ? this.service.categories() : of([]),
      types: this.session.can('ProductType', 'View') ? this.service.productTypes() : of([]),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ categories, types }) => {
          this.categoriesState.set(categories);
          this.typesState.set(types);
        },
        error: () =>
          this.lookupErrorState.set('Không thể tải lựa chọn bộ lọc. Thử tải lại danh sách.'),
      });
  }

  changeSelectedStatus(status: ProductStatus): Observable<unknown> {
    return defer(() => {
      if (!this.canPublish() || this.bulkBusy() || this.loading()) return EMPTY;
      const selected = this.page().items.filter((item) => this.selectedIds().has(item.id));
      if (!selected.length || selected.length > 100) return EMPTY;
      if (selected.some((item) => !item.version)) {
        this.errorState.set('Danh sách thiếu phiên bản sản phẩm. Tải lại trước khi thao tác.');
        return EMPTY;
      }
      this.bulkBusyState.set(true);
      this.errorState.set('');
      this.noticeState.set('');
      return this.service
        .bulkStatus({
          items: selected.map((item) => ({ id: item.id, version: item.version ?? '' })),
          status,
        })
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          tap(() => {
            this.noticeState.set(`Đã cập nhật ${selected.length} sản phẩm.`);
            this.clearSelection();
            this.load();
          }),
          catchError((error: unknown) => {
            this.errorState.set(
              error instanceof ApiError && error.status === 409
                ? 'Có sản phẩm đã thay đổi. Toàn bộ lựa chọn được giữ nguyên; tải lại để đối chiếu trước khi thử lại.'
                : error instanceof ApiError
                  ? error.message
                  : 'Không thể cập nhật. Tải lại để kiểm tra kết quả trước khi thử lại.',
            );
            return EMPTY;
          }),
          finalize(() => this.bulkBusyState.set(false)),
        );
    });
  }

  toggle(id: string): void {
    if (this.bulkBusy()) return;
    if (!this.page().items.some((item) => item.id === id)) return;
    const selected = new Set(this.selectedIds());
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    this.selectionState.set(selected);
  }

  toggleAll(): void {
    if (this.bulkBusy()) return;
    this.selectionState.set(
      this.allSelected() ? new Set() : new Set(this.page().items.map((item) => item.id)),
    );
  }

  clearSelection(): void {
    this.selectionState.set(new Set());
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
      ...Object.fromEntries(
        Object.entries(this.filters()).filter(([key]) =>
          [
            'categoryId',
            'productTypeId',
            'fulfillmentKind',
            'inStock',
            'minimumPrice',
            'maximumPrice',
            'sortBy',
            'sortDirection',
          ].includes(key),
        ),
      ),
    });
  }
}
