import { Component, DestroyRef, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, catchError, map, of, switchMap, tap, timer } from 'rxjs';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  CATALOG_SKELETON_ITEMS,
  CatalogQueryChange,
  CatalogSortOption,
  CategoryDto,
  EMPTY_PRODUCT_PAGE,
  ProductFieldType,
  ProductFulfillmentKind,
  ProductPage,
  ProductSearch,
  ProductSummary,
  PublicFieldFilter,
  PublicProductTypeDto,
} from '@api/storefront/models/storefront.dto';
import {
  getFulfillmentLabel,
  isDigitalFulfillment,
  parseCatalogCategoryId,
  resolveCatalogImageSource,
} from '@api/storefront/models/storefront.util';
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
  readonly sortOptions: { label: string; value: CatalogSortOption }[] = [
    { label: 'Mới nhất', value: 'modified-desc' },
    { label: 'Tên A–Z', value: 'name-asc' },
    { label: 'Tên Z–A', value: 'name-desc' },
    { label: 'Giá tăng dần', value: 'price-asc' },
    { label: 'Giá giảm dần', value: 'price-desc' },
  ];
  readonly page = signal<ProductPage>(EMPTY_PRODUCT_PAGE);
  readonly categories = signal<readonly CategoryDto[]>([]);
  readonly productTypes = signal<readonly PublicProductTypeDto[]>([]);
  readonly selectedCategoryId = signal<string | null>(null);
  readonly selectedProductTypeId = signal<string | null>(null);
  readonly selectedFieldValues = signal<Readonly<Record<string, string>>>({});
  readonly searchQuery = signal('');
  readonly searchDraft = signal('');
  readonly sortOption = signal<CatalogSortOption>('modified-desc');
  readonly inStockOnly = signal(false);
  readonly minPriceDraft = signal<number | null>(null);
  readonly maxPriceDraft = signal<number | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly fieldType = ProductFieldType;
  readonly activeProductType = computed(
    () => this.productTypes().find((t) => t.id === this.selectedProductTypeId()) ?? null,
  );
  readonly productTypeOptions = computed(() => [
    { label: 'Tất cả loại sản phẩm', value: null as string | null },
    ...this.productTypes().map((t) => ({ label: t.name, value: t.id as string | null })),
  ]);
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
    this.loadProductTypes();
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
            productTypeId: query.productTypeId || null,
            fields:
              query.fields && Object.keys(query.fields).length
                ? JSON.stringify(query.fields)
                : null,
            sort: query.sort && query.sort !== 'modified-desc' ? query.sort : null,
            inStock: query.inStock ? 'true' : null,
            minPrice: query.minPrice ?? null,
            maxPrice: query.maxPrice ?? null,
            page: query.page > 1 ? query.page : null,
          },
        });
      });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const search = params.get('search') ?? '';
      const rawPage = Number(params.get('page') ?? 1);
      const categoryId = parseCatalogCategoryId(params.get('categoryId'));
      const productTypeId = parseCatalogCategoryId(params.get('productTypeId'));
      const fields = this.parseFieldsParam(params.get('fields'));
      const rawSort = params.get('sort') as CatalogSortOption | null;
      const sort: CatalogSortOption = this.sortOptions.some((o) => o.value === rawSort)
        ? (rawSort as CatalogSortOption)
        : 'modified-desc';
      const inStock = params.get('inStock') === 'true';
      const rawMin = params.get('minPrice');
      const rawMax = params.get('maxPrice');
      const minPrice = rawMin !== null && Number.isFinite(Number(rawMin)) ? Number(rawMin) : null;
      const maxPrice = rawMax !== null && Number.isFinite(Number(rawMax)) ? Number(rawMax) : null;
      this.searchDraft.set(search);
      this.selectedProductTypeId.set(productTypeId);
      this.selectedFieldValues.set(fields);
      this.sortOption.set(sort);
      this.inStockOnly.set(inStock);
      this.minPriceDraft.set(minPrice);
      this.maxPriceDraft.set(maxPrice);
      this.search({
        search,
        categoryId,
        productTypeId,
        sort,
        inStock,
        minPrice,
        maxPrice,
        pageNumber: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
      });
    });
  }

  onSearchInput(event: Event): void {
    this.searchDraft.set((event.target as HTMLInputElement).value);
    this.emitQuery(1, 300);
  }

  onSelectCategory(categoryId: string | null): void {
    this.selectedCategoryId.set(categoryId);
    this.emitQuery(1, 0);
  }

  onSortChange(sort: CatalogSortOption): void {
    this.sortOption.set(sort);
    this.emitQuery(1, 0);
  }

  onInStockToggle(): void {
    this.inStockOnly.update((v) => !v);
    this.emitQuery(1, 0);
  }

  onPriceFilterApply(): void {
    this.emitQuery(1, 0);
  }

  onProductTypeChange(productTypeId: string | null): void {
    this.selectedProductTypeId.set(productTypeId);
    this.selectedFieldValues.set({});
    this.emitQuery(1, 0);
  }

  onFieldFilterChange(fieldId: string, value: string | null): void {
    const next = { ...this.selectedFieldValues() };
    if (value) next[fieldId] = value;
    else delete next[fieldId];
    this.selectedFieldValues.set(next);
    this.emitQuery(1, 0);
  }

  onPageChange(pageNumber: number): void {
    this.emitQuery(pageNumber, 0);
  }

  onResetFilters(): void {
    this.searchDraft.set('');
    this.selectedCategoryId.set(null);
    this.selectedProductTypeId.set(null);
    this.selectedFieldValues.set({});
    this.sortOption.set('modified-desc');
    this.inStockOnly.set(false);
    this.minPriceDraft.set(null);
    this.maxPriceDraft.set(null);
    this.emitQuery(1, 0);
  }

  private emitQuery(page: number, delay: number): void {
    this.changes.next({
      search: this.searchDraft(),
      categoryId: this.selectedCategoryId(),
      productTypeId: this.selectedProductTypeId(),
      fields: this.selectedFieldValues(),
      sort: this.sortOption(),
      inStock: this.inStockOnly(),
      minPrice: this.minPriceDraft(),
      maxPrice: this.maxPriceDraft(),
      page,
      delay,
    });
  }

  private parseFieldsParam(raw: string | null): Readonly<Record<string, string>> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        );
      }
    } catch {
      return {};
    }
    return {};
  }

  onRetry(): void {
    this.search();
  }

  getProductImageSource(product: ProductSummary): string | null {
    return resolveCatalogImageSource(product.thumbnailMediaId);
  }

  onProductImageError(event: Event, _product: ProductSummary): void {
    const image = event.target as HTMLImageElement;
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

  private loadProductTypes(): void {
    this.catalogService
      .getProductTypes()
      .pipe(
        tap((types) => this.productTypes.set(types)),
        catchError(() => of([])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private buildFieldFilters(): readonly PublicFieldFilter[] | undefined {
    const activeType = this.activeProductType();
    if (!activeType) return undefined;
    const values = this.selectedFieldValues();
    const filters: PublicFieldFilter[] = [];
    for (const field of activeType.fields) {
      const raw = values[field.id];
      if (!raw) continue;
      if (field.dataType === ProductFieldType.Choice) {
        filters.push({ fieldId: field.id, operator: 'in', choiceIds: [raw] });
      } else if (field.dataType === ProductFieldType.Boolean) {
        filters.push({ fieldId: field.id, operator: 'eq', booleanValue: raw === 'true' });
      } else if (field.dataType === ProductFieldType.Text) {
        filters.push({ fieldId: field.id, operator: 'eq', textValue: raw });
      }
    }
    return filters.length ? filters : undefined;
  }

  private search(options?: {
    readonly categoryId?: string | null;
    readonly productTypeId?: string | null;
    readonly search?: string;
    readonly sort?: CatalogSortOption;
    readonly inStock?: boolean;
    readonly minPrice?: number | null;
    readonly maxPrice?: number | null;
    readonly pageNumber?: number;
  }): void {
    if (options?.categoryId !== undefined) {
      this.selectedCategoryId.set(options.categoryId);
    }
    if (options?.productTypeId !== undefined) {
      this.selectedProductTypeId.set(options.productTypeId);
    }
    if (options?.search !== undefined) {
      this.searchQuery.set(options.search);
    }

    this.searchSubscription?.unsubscribe();
    const currentPage = options?.pageNumber ?? this.page().pageNumber;
    const [sortBy, sortDirection] = (options?.sort ?? this.sortOption()).split('-') as [
      'modified' | 'name' | 'price',
      'asc' | 'desc',
    ];
    const request: ProductSearch = {
      pageNumber: currentPage,
      pageSize: 20,
      search: this.searchQuery() || undefined,
      categoryId: this.selectedCategoryId() || undefined,
      productTypeId: this.selectedProductTypeId() || undefined,
      fields: this.buildFieldFilters(),
      inStock: (options?.inStock ?? this.inStockOnly()) ? true : undefined,
      minimumPrice: options?.minPrice ?? this.minPriceDraft() ?? undefined,
      maximumPrice: options?.maxPrice ?? this.maxPriceDraft() ?? undefined,
      sortBy,
      sortDirection,
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
