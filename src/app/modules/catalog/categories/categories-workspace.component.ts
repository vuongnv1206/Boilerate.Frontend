import { Component, OnInit, computed, effect, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subject,
  Subscription,
  catchError,
  debounceTime,
  defer,
  filter,
  finalize,
  forkJoin,
  take,
  tap,
} from 'rxjs';
import { BaseComponent } from '@core/base';
import { ApiError } from '@core/http/api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { CATEGORY_PAGE_SIZE, CATEGORY_SEARCH_DELAY_MS, CategoryDto } from '../models/category.dto';
import { ListQuery, listQueryParams, readListQuery, sameQueryParams } from '../models/product.dto';
import { CategoriesService } from '../services/categories.service';

@Component({
  selector: 'app-categories-workspace',
  host: { class: 'categories-workspace-shell' },
  imports: [SHARED_IMPORTS],
  templateUrl: './categories-workspace.component.html',
})
export class CategoriesWorkspace extends BaseComponent implements OnInit {
  // System variables
  readonly pageSize = CATEGORY_PAGE_SIZE;
  private readonly typing = new Subject<string>();
  private readonly counts = signal<ReadonlyMap<string, number>>(new Map());
  private loadSubscription?: Subscription;

  // Business variables
  readonly editorId = signal<string | null>(null);
  readonly panelOpen = signal(false);
  readonly loaded = signal(false);
  readonly items = signal<readonly CategoryDto[]>([]);
  readonly query = signal('');
  readonly page = signal(1);
  readonly deleting = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  readonly canView = computed(() => this.can('Category', 'View'));
  readonly canCreate = computed(() => this.can('Category', 'Create'));
  readonly canDelete = computed(() => this.can('Category', 'Delete'));
  readonly canViewProducts = computed(() => this.can('Product', 'View'));
  readonly filtered = computed(() => {
    const q = this.query().trim().toLocaleLowerCase('vi');
    return this.items().filter(
      (item) => !q || `${item.name} ${item.slug}`.toLocaleLowerCase('vi').includes(q),
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
    private readonly categoriesService: CategoriesService,
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
      .pipe(debounceTime(CATEGORY_SEARCH_DELAY_MS), takeUntilDestroyed(this.destroyRef))
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
    this.loadSubscription = forkJoin({
      items: this.categoriesService.getAll(),
      counts: this.categoriesService.summaries(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items, counts }) => {
          this.items.set(items);
          this.counts.set(new Map(counts.map((item) => [item.id, item.productCount])));
          this.loaded.set(true);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(this.resolveErrorMessage(error));
        },
      });
  }

  parentName(parentId: string | null): string {
    return this.items().find((item) => item.id === parentId)?.name ?? 'â€”';
  }

  categoryPath(id: string | null): string {
    if (!id) return 'â€”';
    const byId = new Map(this.items().map((item) => [item.id, item]));
    const names: string[] = [];
    const visited = new Set<string>();
    let current = byId.get(id);
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      names.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return names.join(' / ') || 'â€”';
  }

  depth(id: string): number {
    const byId = new Map(this.items().map((item) => [item.id, item]));
    const visited = new Set<string>([id]);
    let current = byId.get(id);
    let depth = 0;
    while (current?.parentId && !visited.has(current.parentId)) {
      visited.add(current.parentId);
      depth++;
      current = byId.get(current.parentId);
    }
    return depth;
  }

  productCount(id: string): number {
    return this.counts().get(id) ?? 0;
  }

  upsert(category: CategoryDto): void {
    this.items.update((records) => {
      const updated = records.some((item) => item.id === category.id)
        ? records.map((item) => (item.id === category.id ? category : item))
        : [...records, category];
      return updated.sort(
        (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
      );
    });
    this.counts.update((counts) => {
      if (counts.has(category.id)) return counts;
      const updated = new Map(counts);
      updated.set(category.id, 0);
      return updated;
    });
    this.loaded.set(true);
  }

  delete(category: CategoryDto): Observable<boolean> {
    return defer(() => {
      if (!this.canDelete() || this.deleting()) return EMPTY;
      this.deleting.set(true);
      this.error.set('');
      this.notice.set('');
      return this.categoriesService.deleteCategory(category.id, category.version).pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        tap((deleted) => {
          if (!deleted) {
            this.error.set('Máy chủ chưa xác nhận xóa danh mục.');
            return;
          }
          this.items.update((records) => records.filter((item) => item.id !== category.id));
          this.notice.set('Đã xóa danh mục.');
        }),
        catchError((error: unknown) => {
          this.error.set(this.resolveErrorMessage(error));
          return EMPTY;
        }),
        finalize(() => this.deleting.set(false)),
      );
    });
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

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof ApiError && error.status === 409) {
      return 'Danh mục đã thay đổi hoặc đang được sử dụng. Tải lại để kiểm tra trước khi xóa.';
    }
    return error instanceof ApiError
      ? error.message
      : 'Không thể tải hoặc thay đổi danh mục. Vui lòng thử lại.';
  }
}
