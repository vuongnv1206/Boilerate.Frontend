import { ButtonDirective } from 'primeng/button';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  OnInit,
  signal,
  inject,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { listQueryParams, readProductListQuery } from '@utils/list-query.util';
import { ProductListQuery } from '@models/list-query.model';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Dialog } from 'primeng/dialog';
import { Checkbox } from 'primeng/checkbox';
import { InputNumber } from 'primeng/inputnumber';
import { Table } from 'primeng/table';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { StatusBadge } from '@shared/ui/status-badge/status-badge.component';
import { FormField } from '@shared/ui/form-field/form-field.component';
import {
  PRODUCT_PAGE_SIZES,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_OPTIONS,
  PRODUCT_FULFILLMENT_OPTIONS,
  PRODUCT_LIST_FULFILLMENT_OPTIONS,
  PRODUCT_STOCK_FILTER_OPTIONS,
  PRODUCT_SORT_OPTIONS,
} from '@constants/product.constants';
import { Subject, debounceTime } from 'rxjs';
import { PRODUCT_SEARCH_DELAY_MS } from '@constants/product.constants';
import { ProductStatus } from '@enums/product.enum';
import { ProductsStore } from '@stores/products.store';
import { MediaPreviewStore } from '@stores/media-preview.store';

@Component({
  selector: 'app-products',
  host: { class: 'collection-screen' },
  imports: [
    RouterLink,
    ContentState,
    Icon,
    CurrencyPipe,
    DatePipe,
    FormsModule,
    InputText,
    Select,
    StatusBadge,
    FormField,
    Dialog,
    Checkbox,
    InputNumber,
    Table,
    ButtonDirective,
  ],
  templateUrl: './products.component.html',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(ProductsStore);
  readonly previews = inject(MediaPreviewStore);
  readonly categoryOptions = computed(() => [...this.store.categories()]);
  readonly typeOptions = computed(() => [...this.store.types()]);
  readonly statuses = PRODUCT_STATUS_LABELS;
  readonly statusOptions = PRODUCT_STATUS_OPTIONS;
  readonly status = ProductStatus;
  readonly pageSizes: number[] = [...PRODUCT_PAGE_SIZES];
  readonly filtersOpen = signal(false);
  readonly bulkTarget = signal<ProductStatus | null>(null);
  readonly fulfillmentOptions = PRODUCT_LIST_FULFILLMENT_OPTIONS;
  readonly stockOptions = PRODUCT_STOCK_FILTER_OPTIONS;
  readonly sortOptions = PRODUCT_SORT_OPTIONS;

  private readonly typing = new Subject<string>();
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
  setStatus(status: ProductStatus | null): void {
    this.update({ ...this.query(), status, page: 1 });
  }
  setPage(page: number): void {
    this.update({ ...this.query(), page });
  }
  resetFilters(): void {
    this.update({ q: '', status: null, page: 1, pageSize: this.query().pageSize });
  }
  filterCount(): number {
    return Object.entries(this.store.filters()).filter(
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
    const query = this.store.filters();
    return `${query.sortBy ?? 'modified'}:${query.sortDirection ?? 'desc'}`;
  }
  setSort(value: string): void {
    const [sortBy, sortDirection] = value.split(':');
    if (
      (sortBy === 'modified' || sortBy === 'name' || sortBy === 'price') &&
      (sortDirection === 'asc' || sortDirection === 'desc')
    )
      this.update({ ...this.query(), sortBy, sortDirection, page: 1 });
  }
  fulfillmentLabel(value: number): string {
    return PRODUCT_FULFILLMENT_OPTIONS.find((option) => option.value === value)?.label ?? '—';
  }
  statusLabel(value: ProductStatus): string {
    return this.statuses[value];
  }
  confirmBulk(): void {
    const target = this.bulkTarget();
    if (target !== null)
      this.store
        .changeSelectedStatus(target)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.bulkTarget.set(null));
  }
  changePageSize(value: number | string): void {
    const pageSize = Number(value);
    if (this.pageSizes.some((size) => size === pageSize))
      this.update({ ...this.query(), pageSize, page: 1 });
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
