import { Component, DestroyRef, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, catchError, map, of, switchMap, tap, timer } from 'rxjs';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  CATALOG_SKELETON_ITEMS,
  CatalogQueryChange,
  CategoryDto,
  EMPTY_PRODUCT_PAGE,
  ProductFulfillmentKind,
  ProductPage,
  ProductSearch,
  ProductSummary,
  getFulfillmentLabel,
  getStorefrontProductFallbackImage,
  isDigitalFulfillment,
  parseCatalogCategoryId,
  resolveCatalogImageSource,
} from '@api/storefront/models/storefront.dto';
import { PublicCatalogService } from '@api/storefront/services/public-catalog.service';

@Component({
  selector: 'app-catalog-list',
  imports: [SHARED_IMPORTS],
  templateUrl: './catalog-list.component.html',
})
export class CatalogListComponent implements OnInit {
  // System variables
  private searchSubscription?: Subscription;
  private readonly changes = new Subject<CatalogQueryChange>();

  // Business variables
  readonly skeletonItems = CATALOG_SKELETON_ITEMS;
  readonly page = signal<ProductPage>(EMPTY_PRODUCT_PAGE);
  readonly categories = signal<readonly CategoryDto[]>([]);
  readonly selectedCategoryId = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly searchDraft = signal('');
  readonly loading = signal(false);
  readonly error = signal('');

  readonly hasProducts = computed(() => this.page().items.length > 0);
  readonly totalPages = computed(() =>
    Math.ceil(this.page().total / Math.max(1, this.page().pageSize)),
  );

  constructor(
    private readonly catalogService: PublicCatalogService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
  ) {
    this.destroyRef.onDestroy(() => this.searchSubscription?.unsubscribe());
  }

  ngOnInit(): void {
    this.loadCategories();
    this.changes
      .pipe(
        switchMap((query) => timer(query.delay).pipe(map(() => query))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((query) => {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {
            search: query.search.trim() || null,
            categoryId: query.categoryId,
            page: query.page > 1 ? query.page : null,
          },
        });
      });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const search = params.get('search') ?? '';
      const rawPage = Number(params.get('page') ?? 1);
      const categoryId = parseCatalogCategoryId(params.get('categoryId'));
      this.searchDraft.set(search);
      this.search({
        search,
        categoryId,
        pageNumber: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
      });
    });
  }

  onSearchInput(event: Event): void {
    this.searchDraft.set((event.target as HTMLInputElement).value);
    this.changes.next({
      search: this.searchDraft(),
      categoryId: this.selectedCategoryId(),
      page: 1,
      delay: 300,
    });
  }

  onSelectCategory(categoryId: string | null): void {
    this.changes.next({ search: this.searchDraft(), categoryId, page: 1, delay: 0 });
  }

  onPageChange(pageNumber: number): void {
    this.changes.next({
      search: this.searchDraft(),
      categoryId: this.selectedCategoryId(),
      page: pageNumber,
      delay: 0,
    });
  }

  onResetFilters(): void {
    this.searchDraft.set('');
    this.changes.next({ search: '', categoryId: null, page: 1, delay: 0 });
  }

  onRetry(): void {
    this.search();
  }

  getProductImageSource(product: ProductSummary): string | null {
    return resolveCatalogImageSource(product.thumbnailMediaId, product.slug, product.name);
  }

  onProductImageError(event: Event, product: ProductSummary): void {
    const image = event.target as HTMLImageElement;
    const fallback = getStorefrontProductFallbackImage(product.slug, product.name);
    if (fallback && !image.src.endsWith(fallback)) {
      image.src = fallback;
      return;
    }

    image.hidden = true;
    image.parentElement?.classList.add('image-unavailable');
  }

  isDigital(kind: ProductFulfillmentKind): boolean {
    return isDigitalFulfillment(kind);
  }

  getFulfillmentLabel(kind: ProductFulfillmentKind): string {
    return getFulfillmentLabel(kind);
  }

  private loadCategories(): void {
    this.catalogService
      .getCategories()
      .pipe(
        tap((categories) => this.categories.set(categories)),
        catchError(() => of([])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private search(options?: {
    readonly categoryId?: string | null;
    readonly search?: string;
    readonly pageNumber?: number;
  }): void {
    if (options?.categoryId !== undefined) {
      this.selectedCategoryId.set(options.categoryId);
    }
    if (options?.search !== undefined) {
      this.searchQuery.set(options.search);
    }

    this.searchSubscription?.unsubscribe();
    const currentPage = options?.pageNumber ?? this.page().pageNumber;
    const request: ProductSearch = {
      pageNumber: currentPage,
      pageSize: 20,
      search: this.searchQuery() || undefined,
      categoryId: this.selectedCategoryId() || undefined,
      sortBy: 'modified',
      sortDirection: 'desc',
    };

    this.loading.set(true);
    this.error.set('');
    this.searchSubscription = this.catalogService
      .searchProducts(request)
      .pipe(
        tap((result) => {
          this.page.set(result);
          this.loading.set(false);
        }),
        catchError((err: unknown) => {
          this.error.set(normalizeApiError(err).message);
          this.loading.set(false);
          return of(EMPTY_PRODUCT_PAGE);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
