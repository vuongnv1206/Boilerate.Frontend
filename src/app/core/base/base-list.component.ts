import { Directive, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription } from 'rxjs';
import { normalizeApiError } from '../http/normalize-api-error';
import { BaseComponent } from './base.component';
import { PagedResult, PaginationParams, normalizePagedResult } from './paged.model';

/**
 * Generic base class for paginated or full-list screens.
 * Cancels superseded in-flight requests automatically when filter/page changes.
 */
@Directive()
export abstract class BaseListComponent<
  TItem,
  TFilter extends object = PaginationParams,
> extends BaseComponent {
  readonly items = signal<readonly TItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly totalPages = computed(() => {
    const size = Math.max(1, this.pageSize());
    return Math.max(1, Math.ceil(this.total() / size));
  });
  readonly filter = signal<TFilter>({} as TFilter);
  readonly isEmpty = computed(
    () => !this.loading() && !this.errorMessage() && this.items().length === 0,
  );

  private activeRequest: Subscription | null = null;
  private generation = 0;

  constructor() {
    super();
    this.destroyRef.onDestroy(() => this.activeRequest?.unsubscribe());
  }

  reload(): void {
    this.activeRequest?.unsubscribe();
    const currentGen = ++this.generation;
    this.loading.set(true);
    this.errorMessage.set('');

    this.activeRequest = this.fetchList(this.filter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (currentGen !== this.generation) return;
          const normalized = normalizePagedResult(response, this.pageSize());
          this.items.set(normalized.items);
          this.total.set(normalized.total);
          this.page.set(normalized.page);
          this.pageSize.set(normalized.pageSize);
          this.loading.set(false);
          this.afterListLoaded(normalized);
        },
        error: (rawError: unknown) => {
          if (currentGen !== this.generation) return;
          this.errorMessage.set(normalizeApiError(rawError).message);
          this.loading.set(false);
        },
      });
  }

  patchFilter(patch: Partial<TFilter>, resetPage = true): void {
    const nextFilter = {
      ...this.filter(),
      ...patch,
      ...(resetPage && 'page' in (this.filter() as Record<string, unknown>) ? { page: 1 } : {}),
    } as TFilter;
    this.filter.set(nextFilter);
    if (resetPage) this.page.set(1);
    this.reload();
  }

  changePage(page: number, pageSize = this.pageSize()): void {
    const safePage = Math.max(1, page);
    const safeSize = Math.max(1, pageSize);
    this.page.set(safePage);
    this.pageSize.set(safeSize);
    this.filter.update(
      (prev) =>
        ({
          ...prev,
          page: safePage,
          pageSize: safeSize,
        }) as TFilter,
    );
    this.reload();
  }

  protected afterListLoaded(_result: PagedResult<TItem>): void {
    void _result;
  }

  protected abstract fetchList(filter: TFilter): Observable<PagedResult<TItem> | readonly TItem[]>;
}
