import { Component, OnInit, computed, effect, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  debounceTime,
  defer,
  filter,
  finalize,
  forkJoin,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { BaseComponent } from '@core/base';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  PRODUCT_SEARCH_DELAY_MS,
  ProductCategoryLookup,
  ProductListQuery,
  ProductPage,
  ProductSearch,
  ProductStatus,
  ProductTypeLookup,
  listQueryParams,
  readProductListQuery,
  sameQueryParams,
} from '@api/catalog/models/product.dto';
import { CategoriesService } from '@api/catalog/services/categories.service';
import { MediaService } from '@api/catalog/services/media.service';
import { ProductTypesService } from '@api/catalog/services/product-types.service';
import { ProductsService } from '@api/catalog/services/products.service';

@Component({
  selector: 'app-products-workspace',
  host: { class: 'products-workspace' },
  imports: [SHARED_IMPORTS],
  templateUrl: './products-workspace.component.html',
})
export class ProductsWorkspace extends BaseComponent implements OnInit {
  // System variables
  private readonly previewOwner = Symbol('products-workspace');
  private readonly typing = new Subject<string>();
  private readonly requests = new Subject<ProductSearch>();
  private requestedPage = 1;

  // Business variables
  readonly editorId = signal<string | null>(null);
  readonly panelOpen = signal(false);

  readonly page = signal<ProductPage>({
    items: [],
    total: 0,
    pageNumber: 1,
    pageSize: 10,
  });
  readonly query = signal('');
  readonly status = signal<ProductStatus | null>(null);
  readonly listError = signal('');
  readonly bulkBusy = signal(false);
  readonly notice = signal('');
  readonly categories = signal<readonly ProductCategoryLookup[]>([]);
  readonly types = signal<readonly ProductTypeLookup[]>([]);
  readonly lookupError = signal('');
  readonly filters = signal<ProductListQuery>({
    q: '',
    status: null,
    page: 1,
    pageSize: 10,
  });
  readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  readonly queryCorrection = signal<number | null>(null);

  readonly canView = computed(() => this.can('Product', 'View'));
  readonly canCreate = computed(() => this.can('Product', 'Create'));
  readonly canPublish = computed(() => this.can('Product', 'Publish'));

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

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly productsService: ProductsService,
    private readonly categoriesService: CategoriesService,
    private readonly productTypesService: ProductTypesService,
    protected readonly previews: MediaService,
  ) {
    super();
    this.requests
      .pipe(
        switchMap((request) => {
          this.loading.set(true);
          this.listError.set('');
          return this.productsService.search(request).pipe(
            catchError((rawError: unknown) => {
              const apiError = normalizeApiError(rawError);
              this.listError.set(
                apiError.status > 0
                  ? apiError.message
                  : 'Không thể tải sản phẩm. Vui lòng thử lại.',
              );
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (!result) return;
        const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
        if (this.requestedPage > lastPage) {
          this.queryCorrection.set(lastPage);
          return;
        }
        this.page.set(result);
        this.selectedIds.set(new Set());
      });

    effect(() => {
      const ids = this.page().items.flatMap((item) =>
        item.thumbnailMediaId ? [item.thumbnailMediaId] : [],
      );
      untracked(() => this.previews.retainPreviews(this.previewOwner, ids));
    });

    effect(() => {
      const correctedPage = this.queryCorrection();
      if (correctedPage !== null) {
        this.updateQuery({ ...this.routeQuery(), page: correctedPage }, true);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.typing.complete();
      this.requests.complete();
      this.previews.releasePreviews(this.previewOwner);
    });
  }

  ngOnInit(): void {
    this.readEditorRoute();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.readEditorRoute();
        this.panelOpen.set(false);
      });

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const parsed = readProductListQuery(params);
      const canonical = listQueryParams(parsed);
      if (
        this.route.snapshot.firstChild?.routeConfig?.path === 'new' &&
        typeof params['duplicateFrom'] === 'string'
      ) {
        canonical['duplicateFrom'] = params['duplicateFrom'];
      }
      if (!sameQueryParams(params, canonical)) {
        this.updateQuery(canonical, true);
        return;
      }
      if (this.canView()) {
        this.applyQuery(parsed);
      }
    });

    this.loadLookups();
    this.typing
      .pipe(debounceTime(PRODUCT_SEARCH_DELAY_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.updateQuery({ ...this.routeQuery(), q, page: 1 }, true));
  }

  routeQuery(): Record<string, string | number> {
    return listQueryParams(readProductListQuery(this.route.snapshot.queryParams));
  }

  search(q: string): void {
    this.typing.next(q);
  }

  setPage(page: number): void {
    this.updateQuery({ ...this.routeQuery(), page });
  }

  applyQuery(query: ProductListQuery): void {
    this.filters.set(query);
    this.query.set(query.q);
    this.status.set(query.status as ProductStatus | null);
    this.page.update((current) => ({ ...current, pageSize: query.pageSize }));
    this.queryCorrection.set(null);
    this.requestPage(query.page);
  }

  load(): void {
    this.requestPage(this.requestedPage);
  }

  loadLookups(): void {
    this.lookupError.set('');
    forkJoin({
      categories: this.can('Category', 'View') ? this.categoriesService.getAll() : of([]),
      types: this.can('ProductType', 'View') ? this.productTypesService.getAll() : of([]),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ categories, types }) => {
          this.categories.set(categories);
          this.types.set(types);
        },
        error: () => {
          this.lookupError.set('Không thể tải lựa chọn bộ lọc. Thử tải lại danh sách.');
        },
      });
  }

  changeSelectedStatus(targetStatus: ProductStatus): Observable<unknown> {
    return defer(() => {
      if (!this.canPublish() || this.bulkBusy() || this.loading()) return EMPTY;
      const selected = this.page().items.filter((item) => this.selectedIds().has(item.id));
      if (!selected.length || selected.length > 100) return EMPTY;
      if (selected.some((item) => !item.version)) {
        this.listError.set('Danh sách thiếu phiên bản sản phẩm. Tải lại trước khi thao tác.');
        return EMPTY;
      }
      this.bulkBusy.set(true);
      this.listError.set('');
      this.notice.set('');
      return this.productsService
        .bulkStatus({
          items: selected.map((item) => ({ id: item.id, version: item.version ?? '' })),
          status: targetStatus,
        })
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          tap(() => {
            this.notice.set(`Đã cập nhật ${selected.length} sản phẩm.`);
            this.clearSelection();
            this.load();
          }),
          catchError((rawError: unknown) => {
            const apiError = normalizeApiError(rawError);
            this.listError.set(
              apiError.status === 409
                ? 'Có sản phẩm đã thay đổi. Toàn bộ lựa chọn được giữ nguyên; tải lại để đối chiếu trước khi thử lại.'
                : apiError.status > 0
                  ? apiError.message
                  : 'Không thể cập nhật. Tải lại để kiểm tra kết quả trước khi thử lại.',
            );
            return EMPTY;
          }),
          finalize(() => this.bulkBusy.set(false)),
        );
    });
  }

  toggle(id: string): void {
    if (this.bulkBusy()) return;
    if (!this.page().items.some((item) => item.id === id)) return;
    const selected = new Set(this.selectedIds());
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    this.selectedIds.set(selected);
  }

  toggleAll(): void {
    if (this.bulkBusy()) return;
    this.selectedIds.set(
      this.allSelected() ? new Set() : new Set(this.page().items.map((item) => item.id)),
    );
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  private requestPage(pageNumber: number): void {
    this.requestedPage = pageNumber;
    const search = this.query().trim();
    const currentStatus = this.status();
    this.requests.next({
      pageNumber,
      pageSize: this.page().pageSize,
      ...(search ? { search } : {}),
      ...(currentStatus === null ? {} : { status: currentStatus }),
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

  private updateQuery(queryParams: Record<string, string | number>, replaceUrl = false): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl });
  }

  private readEditorRoute(): void {
    const child = this.route.snapshot.firstChild;
    this.editorId.set(
      child?.paramMap.get('id') ?? (child?.routeConfig?.path === 'new' ? 'new' : null),
    );
  }
}
