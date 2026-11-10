import {
  Directive,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Params, Router } from '@angular/router';
import { Observable, Subject, catchError, debounceTime, filter, of, switchMap } from 'rxjs';
import { normalizeApiError } from '../http/normalize-api-error';
import { BaseComponent } from './base.component';
import { PageWire } from './paged.model';
import { sameQueryParams } from './query-params.util';

export interface RouteListPatchOptions {
  readonly resetPage?: boolean;
  readonly replaceUrl?: boolean;
}

/**
 * Base class for list workspaces whose filter and page live in the URL query string, with an
 * optional child editor route beside the list.
 *
 * A screen declares only how its query maps to the URL and how a page is fetched:
 * - `parseQuery(params)` — URL -> typed query; must be pure and tolerate missing or invalid values
 * - `serializeQuery(query)` — typed query -> canonical URL params (omit defaults)
 * - `fetchPage(query)`
 *
 * The base owns the rest: rewriting a non-canonical URL, loading on every query change, dropping
 * superseded requests, stepping back when the requested page no longer exists, debounced search,
 * and tracking the open child editor (`editorId`) and the narrow-screen list panel (`panelOpen`).
 *
 * Every change goes through the URL (`patchQuery`), so Back/Forward and reload restore the list.
 */
@Directive()
export abstract class BaseRouteListComponent<TItem, TQuery extends { readonly page: number }>
  extends BaseComponent
  implements OnInit
{
  // System variables
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly searchDelayMs: number = 260;

  private readonly requests = new Subject<TQuery>();
  private readonly typing = new Subject<string>();
  private readonly itemsToggle = viewChild<ElementRef<HTMLButtonElement>>('itemsToggle');

  // Business variables
  readonly page = signal<PageWire<TItem>>({
    items: [],
    total: 0,
    pageNumber: 1,
    pageSize: 20,
  });
  readonly query = signal<TQuery>(this.parseQuery({}));
  readonly queryCorrection = signal<number | null>(null);
  readonly editorId = signal<string | null>(null);
  readonly panelOpen = signal(false);

  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.page().total / Math.max(1, this.page().pageSize))),
  );
  readonly rangeStart = computed(() =>
    this.page().items.length ? (this.page().pageNumber - 1) * this.page().pageSize + 1 : 0,
  );
  readonly rangeEnd = computed(() =>
    this.rangeStart() ? this.rangeStart() + this.page().items.length - 1 : 0,
  );

  protected abstract parseQuery(params: Params): TQuery;
  protected abstract serializeQuery(query: TQuery): Record<string, string | number>;
  protected abstract fetchPage(query: TQuery): Observable<PageWire<TItem>>;

  constructor() {
    super();

    this.requests
      .pipe(
        switchMap((nextQuery) => {
          if (!this.canFetchPage()) {
            return of(null);
          }
          this.loading.set(true);
          this.errorMessage.set('');
          return this.fetchPage(nextQuery).pipe(
            catchError((rawError: unknown) => {
              this.errorMessage.set(this.fetchErrorMessage(rawError));
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (!result) return;
        const lastPage = Math.max(1, Math.ceil(result.total / Math.max(1, result.pageSize)));
        if (this.query().page > lastPage) {
          this.queryCorrection.set(lastPage);
          return;
        }
        this.queryCorrection.set(null);
        this.page.set(result);
        this.onPageLoaded(result);
      });

    this.destroyRef.onDestroy(() => {
      this.requests.complete();
      this.typing.complete();
    });

    effect(() => {
      const correctedPage = this.queryCorrection();
      if (correctedPage !== null) {
        this.patchQuery({ page: correctedPage } as unknown as Partial<TQuery>, {
          replaceUrl: true,
        });
      }
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
      const parsed = this.parseQuery(params);
      const canonical = this.canonicalParams(parsed, params);
      if (!sameQueryParams(params, canonical)) {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: canonical,
          replaceUrl: true,
        });
        return;
      }
      this.applyQuery(parsed);
    });

    this.typing
      .pipe(debounceTime(this.searchDelayMs), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => {
        this.patchQuery({ q, page: 1 } as unknown as Partial<TQuery>, { replaceUrl: true });
      });
  }

  applyQuery(nextQuery: TQuery): void {
    this.query.set(nextQuery);
    this.queryCorrection.set(null);
    this.requests.next(nextQuery);
  }

  load(): void {
    this.requests.next(this.query());
  }

  reload(): void {
    this.load();
  }

  search(q: string): void {
    this.typing.next(q);
  }

  setPage(page: number): void {
    this.patchQuery({ page } as unknown as Partial<TQuery>);
  }

  patchQuery(patch: Partial<TQuery>, options?: RouteListPatchOptions): void {
    const current = this.parseQuery(this.route.snapshot.queryParams);
    const nextQuery: TQuery = {
      ...current,
      ...patch,
      ...(options?.resetPage ? { page: 1 } : {}),
    };
    const canonical = this.canonicalParams(nextQuery, this.route.snapshot.queryParams);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: canonical,
      replaceUrl: options?.replaceUrl ?? false,
    });
  }

  routeQuery(): Record<string, string | number> {
    const current = this.parseQuery(this.route.snapshot.queryParams);
    return this.canonicalParams(current, this.route.snapshot.queryParams);
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.itemsToggle()?.nativeElement.focus();
  }

  protected canFetchPage(): boolean {
    return true;
  }

  protected canonicalParams(query: TQuery, _rawParams: Params): Record<string, string | number> {
    return this.serializeQuery(query);
  }

  protected fetchErrorMessage(rawError: unknown): string {
    const apiError = normalizeApiError(rawError);
    return apiError.status > 0 ? apiError.message : 'Không thể tải dữ liệu. Vui lòng thử lại.';
  }

  protected onPageLoaded(_page: PageWire<TItem>): void {
    return;
  }

  private readEditorRoute(): void {
    const child = this.route.snapshot.firstChild;
    this.editorId.set(
      child?.paramMap.get('id') ?? (child?.routeConfig?.path === 'new' ? 'new' : null),
    );
  }
}
