import { Component, DestroyRef, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  PRODUCT_FULFILLMENT_OPTIONS,
  PRODUCT_LIST_FULFILLMENT_OPTIONS,
  PRODUCT_PAGE_SIZES,
  PRODUCT_SEARCH_DELAY_MS,
  PRODUCT_SORT_OPTIONS,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_OPTIONS,
  PRODUCT_STOCK_FILTER_OPTIONS,
  ProductListQuery,
  ProductStatus,
} from '@api/catalog/models/product.dto';
import { listQueryParams, readProductListQuery } from '@api/catalog/models/product.util';
import { MediaService } from '@api/catalog/services/media.service';
import { ProductsWorkspace } from '../products-workspace.component';

@Component({
  selector: 'app-products',
  host: { class: 'collection-screen' },
  imports: [SHARED_IMPORTS],
  templateUrl: './products.component.html',
})
export class Products implements OnInit {
  // System variables
  protected readonly statuses = PRODUCT_STATUS_LABELS;
  protected readonly statusOptions = PRODUCT_STATUS_OPTIONS;
  protected readonly status = ProductStatus;
  protected readonly pageSizes = PRODUCT_PAGE_SIZES;
  protected readonly fulfillmentOptions = PRODUCT_LIST_FULFILLMENT_OPTIONS;
  protected readonly stockOptions = PRODUCT_STOCK_FILTER_OPTIONS;
  protected readonly sortOptions = PRODUCT_SORT_OPTIONS;
  private readonly typing = new Subject<string>();

  // Business variables
  readonly categoryOptions = computed(() => [...this.workspace.categories()]);
  readonly typeOptions = computed(() => [...this.workspace.types()]);
  readonly filtersOpen = signal(false);
  readonly bulkTarget = signal<ProductStatus | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
    protected readonly workspace: ProductsWorkspace,
    protected readonly previews: MediaService,
  ) {
    this.destroyRef.onDestroy(() => this.typing.complete());
  }

  ngOnInit(): void {
    this.typing
      .pipe(debounceTime(PRODUCT_SEARCH_DELAY_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.update({ ...this.query(), q, page: 1 }, true));
  }

  routeQuery(): Record<string, string | number> {
    return listQueryParams(this.query());
  }

  setQuery(q: string): void {
    this.typing.next(q);
  }

  setStatus(nextStatus: ProductStatus | null): void {
    this.update({ ...this.query(), status: nextStatus, page: 1 });
  }

  setPage(page: number): void {
    this.update({ ...this.query(), page });
  }

  resetFilters(): void {
    this.update({ q: '', status: null, page: 1, pageSize: this.query().pageSize });
  }

  filterCount(): number {
    return Object.entries(this.workspace.filters()).filter(
      ([key, value]) =>
        [
          'status',
          'categoryId',
          'productTypeId',
          'fulfillmentKind',
          'inStock',
          'minimumPrice',
          'maximumPrice',
        ].includes(key) &&
        value !== null &&
        value !== undefined,
    ).length;
  }

  setFilter(
    key:
      | 'categoryId'
      | 'productTypeId'
      | 'fulfillmentKind'
      | 'inStock'
      | 'minimumPrice'
      | 'maximumPrice',
    value: string | number | boolean | null,
  ): void {
    this.update({
      ...this.query(),
      [key]: value === null || value === '' ? undefined : value,
      page: 1,
    });
  }

  setPrice(key: 'minimumPrice' | 'maximumPrice', value: number | null): void {
    this.setFilter(key, value);
  }

  sortValue(): string {
    const current = this.workspace.filters();
    return `${current.sortBy ?? 'modified'}:${current.sortDirection ?? 'desc'}`;
  }

  setSort(value: string): void {
    const [sortBy, sortDirection] = value.split(':');
    if (
      (sortBy === 'modified' || sortBy === 'name' || sortBy === 'price') &&
      (sortDirection === 'asc' || sortDirection === 'desc')
    ) {
      this.update({
        ...this.query(),
        sortBy: sortBy === 'modified' ? undefined : sortBy,
        sortDirection: sortDirection === 'desc' ? undefined : sortDirection,
        page: 1,
      });
    }
  }

  fulfillmentLabel(value: number): string {
    return PRODUCT_FULFILLMENT_OPTIONS.find((option) => option.value === value)?.label ?? '—';
  }

  statusLabel(value: ProductStatus): string {
    return this.statuses[value];
  }

  confirmBulk(): void {
    const target = this.bulkTarget();
    if (target !== null) {
      this.workspace
        .changeSelectedStatus(target)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.bulkTarget.set(null));
    }
  }

  changePageSize(value: number | string): void {
    const pageSize = Number(value);
    if (this.pageSizes.some((size) => size === pageSize)) {
      this.update({ ...this.query(), pageSize, page: 1 });
    }
  }

  private query(): ProductListQuery {
    return readProductListQuery(this.route.snapshot.queryParams);
  }

  private update(query: ProductListQuery, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: listQueryParams(query),
      replaceUrl,
    });
  }
}
