import { Component, OnInit, computed, effect, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Params } from '@angular/router';
import { EMPTY, Observable, catchError, defer, finalize, forkJoin, of, tap } from 'rxjs';
import { BaseRouteListComponent } from '@core/base/base-route-list.component';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  PRODUCT_SEARCH_DELAY_MS,
  ProductCategoryLookup,
  ProductListQuery,
  ProductPage,
  ProductSearch,
  ProductStatus,
  ProductSummary,
  ProductTypeLookup,
  listQueryParams,
  readProductListQuery,
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
export class ProductsWorkspace
  extends BaseRouteListComponent<ProductSummary, ProductListQuery>
  implements OnInit
{
  // System variables
  private readonly previewOwner = Symbol('products-workspace');
  protected override readonly searchDelayMs = PRODUCT_SEARCH_DELAY_MS;

  // Business variables
  readonly listError = this.errorMessage;
  readonly bulkBusy = signal(false);
  readonly notice = signal('');
  readonly categories = signal<readonly ProductCategoryLookup[]>([]);
  readonly types = signal<readonly ProductTypeLookup[]>([]);
  readonly lookupError = signal('');
  readonly filters = this.query;
  readonly status = computed(() => this.query().status as ProductStatus | null);
  readonly selectedIds = signal<ReadonlySet<string>>(new Set());

  readonly canView = computed(() => this.can('Product', 'View'));
  readonly canCreate = computed(() => this.can('Product', 'Create'));
  readonly canPublish = computed(() => this.can('Product', 'Publish'));

  readonly allSelected = computed(
    () =>
      this.page().items.length > 0 &&
      this.page().items.every((item) => this.selectedIds().has(item.id)),
  );

  constructor(
    private readonly productsService: ProductsService,
    private readonly categoriesService: CategoriesService,
    private readonly productTypesService: ProductTypesService,
    protected readonly previews: MediaService,
  ) {
    super();
    this.page.set({
      items: [],
      total: 0,
      pageNumber: 1,
      pageSize: 10,
    });

    effect(() => {
      const ids = this.page().items.flatMap((item) =>
        item.thumbnailMediaId ? [item.thumbnailMediaId] : [],
      );
      untracked(() => this.previews.retainPreviews(this.previewOwner, ids));
    });

    this.destroyRef.onDestroy(() => {
      this.previews.releasePreviews(this.previewOwner);
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadLookups();
  }

  protected override canFetchPage(): boolean {
    return this.canView();
  }

  protected override parseQuery(params: Params): ProductListQuery {
    return readProductListQuery(params);
  }

  protected override serializeQuery(query: ProductListQuery): Record<string, string | number> {
    return listQueryParams(query);
  }

  protected override canonicalParams(
    query: ProductListQuery,
    rawParams: Params,
  ): Record<string, string | number> {
    const canonical = this.serializeQuery(query);
    if (
      this.route.snapshot.firstChild?.routeConfig?.path === 'new' &&
      typeof rawParams['duplicateFrom'] === 'string'
    ) {
      canonical['duplicateFrom'] = rawParams['duplicateFrom'];
    }
    return canonical;
  }

  protected override fetchPage(query: ProductListQuery): Observable<ProductPage> {
    const search = query.q.trim();
    const currentStatus = query.status as ProductStatus | null;
    const request: ProductSearch = {
      pageNumber: query.page,
      pageSize: query.pageSize,
      ...(search ? { search } : {}),
      ...(currentStatus === null ? {} : { status: currentStatus }),
      ...Object.fromEntries(
        Object.entries(query).filter(([key]) =>
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
    };
    return this.productsService.search(request);
  }

  protected override fetchErrorMessage(rawError: unknown): string {
    const apiError = normalizeApiError(rawError);
    return apiError.status > 0 ? apiError.message : 'Không thể tải sản phẩm. Vui lòng thử lại.';
  }

  protected override onPageLoaded(_page: ProductPage): void {
    this.clearSelection();
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
}
