import { Component, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { ListQuery, listQueryParams, readListQuery } from '../../models/product.dto';
import { PRODUCT_TYPE_SEARCH_DELAY_MS } from '../../models/product-type.dto';
import { ProductTypesWorkspace } from '../product-types-workspace.component';

@Component({
  selector: 'app-product-types',
  host: { class: 'collection-screen' },
  imports: [SHARED_IMPORTS],
  templateUrl: './product-types.component.html',
})
export class ProductTypes implements OnInit {
  // System variables
  private readonly typing = new Subject<string>();

  // Business variables
  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
    readonly store: ProductTypesWorkspace,
  ) {
    this.destroyRef.onDestroy(() => this.typing.complete());
  }

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
