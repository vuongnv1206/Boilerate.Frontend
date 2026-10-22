import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { listQueryParams, readListQuery } from '@utils/list-query.util';
import { ListQuery } from '@models/list-query.model';
import { Dialog } from 'primeng/dialog';
import { CATEGORY_SEARCH_DELAY_MS } from '@constants/category.constants';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { StatusBadge } from '@shared/ui/status-badge/status-badge.component';
import { CategoryDto } from '@models/category.dto';
import { CategoriesStore } from '@stores/categories.store';

@Component({
  selector: 'app-categories',
  host: { class: 'collection-screen' },
  imports: [RouterLink, Dialog, ContentState, Icon, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './categories.component.html',
})
export class Categories implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly typing = new Subject<string>();
  readonly store = inject(CategoriesStore);
  readonly deleteTarget = signal<CategoryDto | null>(null);

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
