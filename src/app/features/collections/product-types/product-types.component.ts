import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { listQueryParams, readListQuery } from '@utils/list-query.util';
import { ListQuery } from '@models/list-query.model';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { ProductTypesStore } from '@stores/product-types.store';
import { PRODUCT_TYPE_SEARCH_DELAY_MS } from '@constants/product-type.constants';
import { Subject, debounceTime } from 'rxjs';

@Component({
  selector: 'app-product-types',
  host: { class: 'collection-screen' },
  imports: [RouterLink, ContentState, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-types.component.html',
})
export class ProductTypes implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(ProductTypesStore);
  private readonly typing = new Subject<string>();

  ngOnInit(): void {
    this.typing
      .pipe(debounceTime(PRODUCT_TYPE_SEARCH_DELAY_MS), takeUntilDestroyed(this.destroyRef))
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
