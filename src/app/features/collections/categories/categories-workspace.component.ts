import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { Subject, debounceTime, filter } from 'rxjs';
import { ListQuery } from '@models/list-query.model';
import { CATEGORY_SEARCH_DELAY_MS } from '@constants/category.constants';
import { Icon } from '@shared/ui/icon/icon.component';
import { CategoriesStore } from '@stores/categories.store';
import { listQueryParams, readListQuery, sameQueryParams } from '@utils/list-query.util';

/** Keeps the category list and editor in one navigable workspace. */
@Component({
  selector: 'app-categories-workspace',
  host: { class: 'categories-workspace-shell' },
  imports: [RouterOutlet, RouterLink, Icon, CdkTrapFocus],
  providers: [CategoriesStore],
  templateUrl: './categories-workspace.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesWorkspace implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly typing = new Subject<string>();
  readonly store = inject(CategoriesStore);
  readonly editorId = signal<string | null>(null);
  readonly panelOpen = signal(false);

  constructor() {
    effect(() => {
      if (
        this.store.loaded() &&
        !this.store.loading() &&
        this.store.page() > this.store.totalPages()
      )
        this.updateQuery(
          { ...readListQuery(this.route.snapshot.queryParams), page: this.store.totalPages() },
          true,
        );
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
      const query = readListQuery(params);
      const canonical = listQueryParams(query);
      if (!sameQueryParams(params, canonical)) {
        this.updateQuery(query, true);
        return;
      }
      if (this.store.canView()) this.store.applyQuery(query);
    });
    if (this.store.canView()) this.store.load();
    this.typing
      .pipe(debounceTime(CATEGORY_SEARCH_DELAY_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.updateQuery({ ...this.routeQuery(), q, page: 1 }, true));
  }

  routeQuery(): Record<string, string | number> {
    return listQueryParams(readListQuery(this.route.snapshot.queryParams));
  }

  search(query: string): void {
    this.typing.next(query);
  }

  setPage(page: number): void {
    this.updateQuery({ ...readListQuery(this.route.snapshot.queryParams), page });
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
