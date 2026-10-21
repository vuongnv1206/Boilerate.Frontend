import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { Subject, debounceTime, filter } from 'rxjs';
import { PRODUCT_SEARCH_DELAY_MS } from '@constants/product.constants';
import { Icon } from '@shared/ui/icon/icon.component';
import { MediaPreviewStore } from '@stores/media-preview.store';
import { ProductsStore } from '@stores/products.store';
import { listQueryParams, readProductListQuery, sameQueryParams } from '@utils/list-query.util';

/** Products route owns one list scope across the list/editor transition. */
@Component({
  selector: 'app-products-workspace',
  host: { class: 'products-workspace' },
  imports: [RouterOutlet, RouterLink, Icon, CdkTrapFocus],
  providers: [ProductsStore, MediaPreviewStore],
  templateUrl: './products-workspace.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsWorkspace implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly typing = new Subject<string>();
  readonly store = inject(ProductsStore);
  readonly previews = inject(MediaPreviewStore);
  readonly editorId = signal<string | null>(null);
  readonly panelOpen = signal(false);

  constructor() {
    effect(() => {
      const ids = this.store
        .page()
        .items.flatMap((item) => (item.thumbnailMediaId ? [item.thumbnailMediaId] : []));
      untracked(() => this.previews.load(ids));
    });
    effect(() => {
      const page = this.store.queryCorrection();
      if (page !== null) this.updateQuery({ ...this.routeQuery(), page }, true);
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
      const query = readProductListQuery(params);
      const canonical = listQueryParams(query);
      if (
        this.route.snapshot.firstChild?.routeConfig?.path === 'new' &&
        typeof params['duplicateFrom'] === 'string'
      )
        canonical['duplicateFrom'] = params['duplicateFrom'];
      if (!sameQueryParams(params, canonical)) {
        this.updateQuery(canonical, true);
        return;
      }
      if (this.store.canView()) this.store.applyQuery(query);
    });
    this.store.loadLookups();
    this.typing
      .pipe(debounceTime(PRODUCT_SEARCH_DELAY_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.updateQuery({ ...this.routeQuery(), q, page: 1 }, true));
  }

  routeQuery(): Record<string, string | number> {
    return listQueryParams(readProductListQuery(this.route.snapshot.queryParams));
  }
  search(q: string): void {
    this.typing.next(q);
  }
  setPage(page: number): void {
    this.updateQuery({ ...this.routeQuery(), page });
  }

  private updateQuery(queryParams: Record<string, string | number>, replaceUrl = false): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl });
  }
  private readEditorRoute(): void {
    const child = this.route.snapshot.firstChild;
    this.editorId.set(
      child?.paramMap.get('id') ?? (child?.routeConfig?.path === 'new' ? 'new' : null),
    );
  }
}
