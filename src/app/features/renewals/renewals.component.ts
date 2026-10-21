import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { RenewalStatus } from '@models/renewal.dto';
import { RENEWAL_STATUS_FILTER_OPTIONS, RENEWAL_STATUS_LABELS } from '@constants/renewal.constants';
import { RenewalsStore } from '@stores/renewals.store';

@Component({
  selector: 'app-renewals',
  imports: [RouterLink, ContentState, Icon],
  templateUrl: './renewals.component.html',
  styleUrl: '../../../styles/admin/_renewals.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Renewals implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(RenewalsStore);
  readonly statuses = RENEWAL_STATUS_LABELS;
  readonly statusOptions = RENEWAL_STATUS_FILTER_OPTIONS;
  readonly pageNumbers = computed(() =>
    Array.from({ length: this.store.pageCount() }, (_, index) => index + 1),
  );

  constructor() {
    effect(() => {
      const page = this.store.pageCorrection();
      if (page !== null) void this.updateQuery(page, this.store.selectedStatus());
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(
        map((params) => {
          const rawPage = Number(params.get('page') ?? 1);
          const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
          const rawStatus = params.get('status');
          const status = rawStatus === null ? null : (Number(rawStatus) as RenewalStatus);
          return {
            page,
            status:
              status !== null && Object.values(RenewalStatus).includes(status) ? status : null,
          };
        }),
        distinctUntilChanged(
          (left, right) => left.page === right.page && left.status === right.status,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ page, status }) => this.store.loadPage(page, status));
  }

  async setStatus(value: string): Promise<void> {
    await this.updateQuery(1, value === '' ? null : (Number(value) as RenewalStatus));
  }

  previous(): void {
    if (this.store.page().pageNumber > 1)
      void this.updateQuery(this.store.page().pageNumber - 1, this.store.selectedStatus());
  }

  next(): void {
    if (this.store.page().pageNumber < this.store.pageCount())
      void this.updateQuery(this.store.page().pageNumber + 1, this.store.selectedStatus());
  }

  updateQuery(page: number, status: RenewalStatus | null): Promise<boolean> {
    const queryParams = { page: page > 1 ? page : null, status };
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
