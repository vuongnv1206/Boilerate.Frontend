import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Subject, debounceTime } from 'rxjs';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { StatusBadge } from '@shared/ui/status-badge/status-badge.component';
import { DiscountsStore } from '@stores/discounts.store';
import { readListQuery } from '@utils/list-query.util';
import { DISCOUNT_STATUS_OPTIONS } from '@constants/discount.constants';

@Component({
  selector: 'app-discounts',
  host: { class: 'collection-screen' },
  imports: [
    ButtonDirective,
    InputText,
    Select,
    TableModule,
    RouterLink,
    CurrencyPipe,
    FormsModule,
    ContentState,
    Icon,
    StatusBadge,
  ],
  providers: [DiscountsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './discounts.component.html',
})
export class Discounts implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly typing = new Subject<string>();
  readonly store = inject(DiscountsStore);
  readonly page = signal(1);
  readonly searchValue = signal('');
  readonly active = signal<'all' | 'true' | 'false'>('all');
  readonly statuses = [...DISCOUNT_STATUS_OPTIONS];

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
    const value = active === 'true' || active === 'false' ? active : 'all';
    this.active.set(value);
    this.navigate(1, this.searchValue().trim(), value);
  }
  reload(): void {
    this.store.load(
      this.page(),
      this.searchValue(),
      this.active() === 'all' ? null : this.active() === 'true',
    );
  }
  totalPages(): number {
    return Math.max(1, Math.ceil(this.store.total() / 20));
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
