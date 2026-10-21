import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { listQueryParams, sameQueryParams, readListQuery } from '@utils/list-query.util';
import { ListQuery } from '@models/list-query.model';
import { Dialog } from 'primeng/dialog';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { CategoryDto } from '@models/category.dto';
import { CategoriesStore } from '@stores/categories.store';

@Component({
  selector: 'app-categories',
  host: { class: 'collection-screen' },
  imports: [RouterLink, Dialog, ContentState, Icon],
  providers: [CategoriesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './categories.component.html',
})
export class Categories implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(CategoriesStore);
  readonly deleteTarget = signal<CategoryDto | null>(null);

  constructor() {
    effect(() => {
      if (
        this.store.loaded() &&
        !this.store.loading() &&
        this.store.page() > this.store.totalPages()
      )
        this.update({ ...this.query(), page: this.store.totalPages() }, true);
    });
  }
  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const query = readListQuery(params);
      if (!sameQueryParams(params, listQueryParams(query))) {
        this.update(query, true);
        return;
      }
      this.store.applyQuery(query);
    });
    this.store.load();
  }
  routeQuery(): Record<string, string | number> {
    return listQueryParams(this.query());
  }
  search(q: string): void {
    this.update({ q, page: 1 }, true);
  }
  setPage(page: number): void {
    this.update({ ...this.query(), page });
  }
  delete(): void {
    const target = this.deleteTarget();
    if (target)
      this.store
        .delete(target)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((deleted) => {
          if (deleted) this.deleteTarget.set(null);
        });
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
