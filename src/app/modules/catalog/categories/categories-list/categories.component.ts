import { Component, DestroyRef, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { CATEGORY_SEARCH_DELAY_MS, CategoryDto } from '../../models/category.dto';
import { ListQuery, listQueryParams, readListQuery } from '../../models/product.dto';
import { CategoriesWorkspace } from '../categories-workspace.component';

@Component({
  selector: 'app-categories',
  host: { class: 'collection-screen' },
  imports: [SHARED_IMPORTS],
  templateUrl: './categories.component.html',
})
export class Categories implements OnInit {
  // System variables
  private readonly typing = new Subject<string>();

  // Business variables
  readonly deleteTarget = signal<CategoryDto | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
    readonly store: CategoriesWorkspace,
  ) {
    this.destroyRef.onDestroy(() => this.typing.complete());
  }

  ngOnInit(): void {
    this.typing
      .pipe(debounceTime(CATEGORY_SEARCH_DELAY_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.update({ ...this.query(), q, page: 1 }, true));
  }

  routeQuery(): Record<string, string | number> {
    return listQueryParams(this.query());
  }

  search(q: string): void {
    this.typing.next(q);
  }

  setPage(page: number): void {
    this.update({ ...this.query(), page });
  }

  delete(): void {
    const target = this.deleteTarget();
    if (target) {
      this.store
        .delete(target)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((deleted) => {
          if (deleted) this.deleteTarget.set(null);
        });
    }
  }

  private query(): ListQuery {
    return readListQuery(this.route.snapshot.queryParams);
  }

  private update(query: ListQuery, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: listQueryParams(query),
      replaceUrl,
    });
  }
}
