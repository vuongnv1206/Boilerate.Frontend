import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { listQueryParams, sameQueryParams, readProductListQuery } from '@utils/list-query.util';
import { ProductListQuery } from '@models/list-query.model';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { StatusBadge } from '@shared/ui/status-badge/status-badge.component';
import {
  PRODUCT_PAGE_SIZES,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_OPTIONS,
} from '@constants/product.constants';
import { Subject, debounceTime } from 'rxjs';
import { PRODUCT_SEARCH_DELAY_MS } from '@constants/product.constants';
import { ProductStatus } from '@enums/product.enum';
import { ProductsStore } from '@stores/products.store';

@Component({
  selector: 'app-products',
  host: { class: 'collection-screen' },
  imports: [
    RouterLink,
    ContentState,
    Icon,
    CurrencyPipe,
    FormsModule,
    InputText,
    Select,
    StatusBadge,
  ],
  providers: [ProductsStore],
  templateUrl: './products.component.html',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(ProductsStore);
  readonly statuses = PRODUCT_STATUS_LABELS;
  readonly statusOptions = PRODUCT_STATUS_OPTIONS;
  readonly status = ProductStatus;
  readonly pageSizes = PRODUCT_PAGE_SIZES;

  private readonly typing = new Subject<string>();
  constructor() {
    effect(() => {
      const page = this.store.queryCorrection();
      if (page !== null) this.update({ ...this.query(), page }, true);
    });
  }
  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const query = readProductListQuery(params);
      if (!sameQueryParams(params, listQueryParams(query))) {
        this.update(query, true);
        return;
      }
      this.store.applyQuery(query);
    });
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
    this.update({ ...this.query(), q: '', status: null, page: 1 });
  }
  changePageSize(event: Event): void {
    if (event.target instanceof HTMLSelectElement)
      this.update({ ...this.query(), pageSize: Number(event.target.value), page: 1 });
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
