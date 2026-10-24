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
import { distinctUntilChanged, filter, map } from 'rxjs';
import { RenewalStatus } from '@models/renewal.dto';
import {
  RENEWAL_STATUS_FILTER_OPTIONS,
  RENEWAL_STATUS_LABELS,
  renewalStatusTone,
} from '@constants/renewal.constants';
import { Icon } from '@shared/ui/icon/icon.component';
import { StatusBadge } from '@shared/ui/status-badge/status-badge.component';
import { RenewalsStore } from '@stores/renewals.store';

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

    this.route.queryParamMap
      .pipe(
        map((params) => {
          const rawPage = Number(params.get('page') ?? 1);
          const rawStatus = params.get('status');
          const status = rawStatus === null ? null : (Number(rawStatus) as RenewalStatus);
          return {
            page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
            status:
              status !== null && Object.values(RenewalStatus).includes(status) ? status : null,
          };
        }),
        distinctUntilChanged(
          (left, right) => left.page === right.page && left.status === right.status,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ page, status }) => {
        const params = this.route.snapshot.queryParams;
        const normalizedPage = page > 1 ? String(page) : null;
        const normalizedStatus = status === null ? null : String(status);
        if (
          (params['page'] ?? null) !== normalizedPage ||
          (params['status'] ?? null) !== normalizedStatus
        ) {
          this.updateQuery(page, status, true);
          return;
        }
        this.store.loadPage(page, status);
      });
  }

  routeQuery(): Record<string, string | number> {
    const params = this.route.snapshot.queryParams;
    const rawPage = Number(params['page'] ?? 1);
    const rawStatus = Number(params['status']);
    const page = Number.isSafeInteger(rawPage) && rawPage > 1 ? rawPage : 1;
    const status = Object.values(RenewalStatus).includes(rawStatus as RenewalStatus)
      ? (rawStatus as RenewalStatus)
      : null;
    return { ...(page > 1 ? { page } : {}), ...(status !== null ? { status } : {}) };
  }

  setStatus(value: string | number | null): void {
    const status = value === '' || value === null ? null : (Number(value) as RenewalStatus);
    this.updateQuery(1, status);
  }

  setPage(page: number): void {
    this.updateQuery(page, this.store.selectedStatus());
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.itemsToggle()?.nativeElement.focus();
  }

  private updateQuery(page: number, status: RenewalStatus | null, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 1 ? page : null, status },
      replaceUrl,
    });
  }

  private readEditorRoute(): void {
    this.editorId.set(this.route.snapshot.firstChild?.paramMap.get('id') ?? null);
  }
}
