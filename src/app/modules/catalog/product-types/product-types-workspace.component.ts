import { Component, OnInit, computed, effect, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subject, Subscription, debounceTime, filter } from 'rxjs';
import { BaseComponent } from '@core/base';
import { ApiError } from '@core/http/api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { sameQueryParams } from '@shared/utils/query-params.util';
import { ListQuery, listQueryParams, readListQuery } from '@api/catalog/models/product.dto';
import {
  PRODUCT_TYPE_PAGE_SIZE,
  PRODUCT_TYPE_SEARCH_DELAY_MS,
  ProductTypeDto,
} from '@api/catalog/models/product-type.dto';
import { ProductTypesService } from '@api/catalog/services/product-types.service';

@Component({
  selector: 'app-product-types-workspace',
  host: { class: 'product-types-workspace-shell' },
  imports: [SHARED_IMPORTS],
  templateUrl: './product-types-workspace.component.html',
})
export class ProductTypesWorkspace extends BaseComponent implements OnInit {
  // System variables
  readonly pageSize = PRODUCT_TYPE_PAGE_SIZE;
  private readonly typing = new Subject<string>();
  private loadSubscription?: Subscription;

  // Business variables
  readonly editorId = signal<string | null>(null);
  readonly panelOpen = signal(false);
  readonly loaded = signal(false);
  readonly items = signal<readonly ProductTypeDto[]>([]);
  readonly query = signal('');
  readonly page = signal(1);
  readonly error = signal('');

  readonly canView = computed(() => this.can('ProductType', 'View'));
  readonly canCreate = computed(() => this.can('ProductType', 'Create'));
  readonly filtered = computed(() => {
    const q = this.query().trim().toLocaleLowerCase('vi');
    return this.items().filter(
      (item) => !q || `${item.name} ${item.code}`.toLocaleLowerCase('vi').includes(q),
    );
  });
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize)),
  );
  readonly rows = computed(() =>
    this.filtered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize),
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly productTypesService: ProductTypesService,
  ) {
    super();
    effect(() => {
      if (this.loaded() && !this.loading() && this.page() > this.totalPages()) {
        this.updateQuery(
          { ...readListQuery(this.route.snapshot.queryParams), page: this.totalPages() },
          true,
        );
      }
    });
    this.destroyRef.onDestroy(() => {
      this.typing.complete();
      this.loadSubscription?.unsubscribe();
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
      const parsed = readListQuery(params);
      const canonical = listQueryParams(parsed);
      if (!sameQueryParams(params, canonical)) {
        this.updateQuery(parsed, true);
        return;
      }
      if (this.canView()) {
        this.applyQuery(parsed);
      }
    });
    if (this.canView()) {
      this.load();
    }
    this.typing
      .pipe(debounceTime(PRODUCT_TYPE_SEARCH_DELAY_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) =>
        this.updateQuery({ ...readListQuery(this.route.snapshot.queryParams), q, page: 1 }, true),
      );
  }

  routeQuery(): Record<string, string | number> {
    return listQueryParams(readListQuery(this.route.snapshot.queryParams));
  }

  search(q: string): void {
    this.typing.next(q);
  }

  setPage(page: number): void {
    this.updateQuery({ ...readListQuery(this.route.snapshot.queryParams), page });
  }

  applyQuery(query: ListQuery): void {
    this.query.set(query.q);
    this.page.set(query.page);
  }

  load(): void {
    this.loadSubscription?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.loadSubscription = this.productTypesService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.items.set(
            [...items].sort((left, right) => left.name.localeCompare(right.name, 'vi')),
          );
          this.loaded.set(true);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(
            error instanceof ApiError ? error.message : 'Không thể tải loại sản phẩm.',
          );
        },
      });
  }

  upsert(item: ProductTypeDto): void {
    this.items.update((records) => {
      const updated = records.some((current) => current.id === item.id)
        ? records.map((current) => (current.id === item.id ? item : current))
        : [...records, item];
      return updated.sort((left, right) => left.name.localeCompare(right.name, 'vi'));
    });
    this.loaded.set(true);
  }

  private updateQuery(query: ListQuery, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: listQueryParams(query),
      replaceUrl,
    });
  }

  private readEditorRoute(): void {
    const child = this.route.snapshot.firstChild;
    this.editorId.set(
      child?.paramMap.get('id') ?? (child?.routeConfig?.path === 'new' ? 'new' : null),
    );
  }
}
