import { Component, DestroyRef, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { readListQuery } from '@shared/utils/query-params.util';
import { DISCOUNT_STATUS_OPTIONS, DiscountActiveFilter, DiscountDto } from '../models/discount.dto';
import { DiscountsService } from '../services/discounts.service';

@Component({
  selector: 'app-discounts',
  host: { class: 'collection-screen' },
  imports: [SHARED_IMPORTS],
  templateUrl: './discounts.component.html',
})
export class Discounts implements OnInit {
  // System variables
  private readonly typing = new Subject<string>();
  private request?: Subscription;

  // Business variables
  readonly page = signal(1);
  readonly searchValue = signal('');
  readonly active = signal<DiscountActiveFilter>('all');
  readonly items = signal<readonly DiscountDto[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly statuses = [...DISCOUNT_STATUS_OPTIONS];
  readonly canCreate = computed(() => this.session.can('Discount', 'Create'));

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
    private readonly discountsService: DiscountsService,
    private readonly session: AuthSession,
  ) {
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const query = readListQuery({ q: params.get('q'), page: params.get('page') });
      const active = params.get('active');
      this.page.set(query.page);
      this.searchValue.set(query.q);
      this.active.set(active === 'true' || active === 'false' ? active : 'all');
      this.reload();
    });
    this.typing
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.navigate(1, q.trim(), this.active(), true));
  }

  search(q: string): void {
    this.searchValue.set(q);
    this.typing.next(q);
  }

  setPage(page: number): void {
    this.navigate(page, this.searchValue(), this.active());
  }

  setActive(active: string): void {
    const value: DiscountActiveFilter = active === 'true' || active === 'false' ? active : 'all';
    this.active.set(value);
    this.navigate(1, this.searchValue().trim(), value);
  }

  reload(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    const isActive = this.active() === 'all' ? null : this.active() === 'true';
    this.request = this.discountsService
      .listDiscounts(this.page(), this.searchValue(), isActive)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.items.set(page.items);
          this.total.set(page.total);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(normalizeApiError(err).message);
        },
      });
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / 20));
  }

  private navigate(page: number, q: string, active: string, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...(q ? { q } : {}),
        ...(page > 1 ? { page } : {}),
        ...(active !== 'all' ? { active } : {}),
      },
      replaceUrl,
    });
  }
}
