import { Component, ElementRef, OnInit, computed, effect, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subject, catchError, filter, map, of, switchMap } from 'rxjs';
import { BaseComponent } from '@core/base';
import { ApiError } from '@core/http/api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  RENEWAL_QUEUE_LABELS,
  RENEWAL_STATUS_FILTER_OPTIONS,
  RENEWAL_STATUS_LABELS,
  RenewalPage,
  RenewalQueue,
  RenewalStatus,
  readRenewalListQuery,
  renewalListQueryParams,
  renewalStatusTone,
  sameRenewalQueryParams,
} from '../models/renewal.dto';
import { RenewalsService } from '../services/renewals.service';

@Component({
  selector: 'app-renewals-workspace',
  host: { class: 'renewals-workspace-shell' },
  imports: [SHARED_IMPORTS],
  templateUrl: './renewals-workspace.component.html',
})
export class RenewalsWorkspace extends BaseComponent implements OnInit {
  // System variables
  private readonly pageRequests = new Subject<{
    readonly page: number;
    readonly status: RenewalStatus | null;
    readonly queue: RenewalQueue | null;
    readonly afterWrite: boolean;
  }>();
  private requestedPage = 1;
  private readonly itemsToggle = viewChild<ElementRef<HTMLButtonElement>>('itemsToggle');

  // Business variables
  readonly page = signal<RenewalPage>({
    items: [],
    total: 0,
    pageNumber: 1,
    pageSize: 20,
  });
  readonly selectedStatus = signal<RenewalStatus | null>(null);
  readonly selectedQueue = signal<RenewalQueue | null>(null);
  readonly pageCorrection = signal<number | null>(null);
  readonly editorId = signal<string | null>(null);
  readonly panelOpen = signal(false);
  readonly statusLabels = RENEWAL_STATUS_LABELS;
  readonly statusTone = renewalStatusTone;
  readonly statusOptions = RENEWAL_STATUS_FILTER_OPTIONS;
  readonly queueLabels = RENEWAL_QUEUE_LABELS;

  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.page().total / this.page().pageSize)),
  );
  readonly canViewOrders = computed(() => this.can('Order', 'View'));

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly renewalsService: RenewalsService,
  ) {
    super();
    this.pageRequests
      .pipe(
        switchMap(({ page, status, queue, afterWrite }) => {
          this.loading.set(true);
          this.errorMessage.set('');
          return this.renewalsService.list(page, status, queue).pipe(
            catchError((error: unknown) => {
              const message =
                error instanceof ApiError ? error.message : 'Không thể tải danh sách gia hạn.';
              this.errorMessage.set(afterWrite ? `Thao tác đã lưu. ${message}` : message);
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (!result) return;
        const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
        if (result.pageNumber > lastPage) {
          this.pageCorrection.set(lastPage);
          return;
        }
        this.pageCorrection.set(null);
        this.page.set(result);
      });
    this.destroyRef.onDestroy(() => this.pageRequests.complete());

    effect(() => {
      const corrected = this.pageCorrection();
      if (corrected !== null) {
        this.updateQuery(corrected, this.selectedStatus(), true);
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
        this.loadPage(page, status, queue);
      });
  }

  loadPage(
    page = 1,
    status = this.selectedStatus(),
    queue = this.selectedQueue(),
    afterWrite = false,
  ): void {
    const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
    this.requestedPage = safePage;
    this.selectedStatus.set(status);
    this.selectedQueue.set(queue);
    this.pageCorrection.set(null);
    this.pageRequests.next({ page: safePage, status, queue, afterWrite });
  }

  refreshPage(afterWrite = true): void {
    this.pageCorrection.set(null);
    this.pageRequests.next({
      page: this.requestedPage,
      status: this.selectedStatus(),
      queue: this.selectedQueue(),
      afterWrite,
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
    this.updateQuery(page, this.selectedStatus());
  }

  clearQueue(): void {
    this.updateQuery(1, this.selectedStatus(), false, null);
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.itemsToggle()?.nativeElement.focus();
  }

  private updateQuery(
    page: number,
    status: RenewalStatus | null,
    replaceUrl = false,
    queue: RenewalQueue | null = this.selectedQueue(),
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
