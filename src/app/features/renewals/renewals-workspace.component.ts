import { ButtonDirective } from 'primeng/button';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { RenewalQueue, RenewalStatus } from '@models/renewal.dto';
import {
  RENEWAL_STATUS_FILTER_OPTIONS,
  RENEWAL_STATUS_LABELS,
  RENEWAL_QUEUE_LABELS,
  renewalStatusTone,
} from '@constants/renewal.constants';
import { Icon } from '@shared/ui/icon/icon.component';
import { StatusBadge } from '@shared/ui/status-badge/status-badge.component';
import { RenewalsStore } from '@stores/renewals.store';
import {
  readRenewalListQuery,
  renewalListQueryParams,
  sameRenewalQueryParams,
} from '@utils/renewal-query.util';

@Component({
  selector: 'app-renewals-workspace',
  host: { class: 'renewals-workspace-shell' },
  imports: [
    RouterOutlet,
    RouterLink,
    Icon,
    StatusBadge,
    CdkTrapFocus,
    FormsModule,
    Select,
    ButtonDirective,
  ],
  templateUrl: './renewals-workspace.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RenewalsWorkspace implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(RenewalsStore);
  readonly editorId = signal<string | null>(null);
  readonly panelOpen = signal(false);
  private readonly itemsToggle = viewChild<ElementRef<HTMLButtonElement>>('itemsToggle');
  readonly statusLabels = RENEWAL_STATUS_LABELS;
  readonly statusTone = renewalStatusTone;
  readonly statusOptions = RENEWAL_STATUS_FILTER_OPTIONS;
  readonly queueLabels = RENEWAL_QUEUE_LABELS;

  constructor() {
    effect(() => {
      const page = this.store.pageCorrection();
      if (page !== null) this.updateQuery(page, this.store.selectedStatus(), true);
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

    this.route.queryParams
      .pipe(
        map((params) => readRenewalListQuery(params)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ page, status, queue }) => {
        const params = this.route.snapshot.queryParams;
        if (!sameRenewalQueryParams(params, renewalListQueryParams({ page, status, queue }))) {
          this.updateQuery(page, status, true, queue);
          return;
        }
        this.store.loadPage(page, status, queue);
      });
  }

  routeQuery(): Record<string, string | number> {
    return renewalListQueryParams(readRenewalListQuery(this.route.snapshot.queryParams));
  }

  setStatus(value: string | number | null): void {
    const status = value === '' || value === null ? null : (Number(value) as RenewalStatus);
    this.updateQuery(1, status);
  }

  setPage(page: number): void {
    this.updateQuery(page, this.store.selectedStatus());
  }

  clearQueue(): void {
    this.updateQuery(1, this.store.selectedStatus(), false, null);
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.itemsToggle()?.nativeElement.focus();
  }

  private updateQuery(
    page: number,
    status: RenewalStatus | null,
    replaceUrl = false,
    queue: RenewalQueue | null = this.store.selectedQueue(),
  ): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: renewalListQueryParams({ page, status, queue }),
      replaceUrl,
    });
  }

  private readEditorRoute(): void {
    this.editorId.set(this.route.snapshot.firstChild?.paramMap.get('id') ?? null);
  }
}
