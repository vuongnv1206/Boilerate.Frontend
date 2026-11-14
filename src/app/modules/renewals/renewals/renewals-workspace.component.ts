import { Component, computed } from '@angular/core';
import { Params } from '@angular/router';
import { Observable } from 'rxjs';
import { BaseRouteListComponent } from '@core/base/base-route-list.component';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { sameQueryParams } from '@core/base/query-params.util';
import {
  RENEWAL_QUEUE_LABELS,
  RENEWAL_STATUS_FILTER_OPTIONS,
  RENEWAL_STATUS_LABELS,
  RenewalAdminDto,
  RenewalListQuery,
  RenewalPage,
  RenewalStatus,
} from '@api/renewals/models/renewal.dto';
import {
  readRenewalListQuery,
  renewalListQueryParams,
  renewalStatusTone,
} from '@api/renewals/models/renewal.util';
import { RenewalsService } from '@api/renewals/services/renewals.service';

@Component({
  selector: 'app-renewals-workspace',
  host: { class: 'renewals-workspace-shell' },
  imports: [SHARED_IMPORTS],
  templateUrl: './renewals-workspace.component.html',
})
export class RenewalsWorkspace extends BaseRouteListComponent<RenewalAdminDto, RenewalListQuery> {
  // System variables
  private afterWrite = false;

  // Business variables
  readonly selectedStatus = computed(() => this.query().status);
  readonly selectedQueue = computed(() => this.query().queue);
  readonly statusLabels = RENEWAL_STATUS_LABELS;
  readonly statusTone = renewalStatusTone;
  readonly statusOptions = RENEWAL_STATUS_FILTER_OPTIONS;
  readonly queueLabels = RENEWAL_QUEUE_LABELS;

  readonly canViewOrders = computed(() => this.can('Order', 'View'));

  constructor(private readonly renewalsService: RenewalsService) {
    super();
  }

  protected override parseQuery(params: Params): RenewalListQuery {
    return readRenewalListQuery(params);
  }

  protected override serializeQuery(query: RenewalListQuery): Record<string, string | number> {
    return renewalListQueryParams(query);
  }

  protected override fetchPage(query: RenewalListQuery): Observable<RenewalPage> {
    return this.renewalsService.list(query.page, query.status, query.queue);
  }

  protected override fetchErrorMessage(rawError: unknown): string {
    const apiError = normalizeApiError(rawError);
    const message = apiError.status > 0 ? apiError.message : 'Không thể tải danh sách gia hạn.';
    const finalMessage = this.afterWrite ? `Thao tác đã lưu. ${message}` : message;
    this.afterWrite = false;
    return finalMessage;
  }

  loadPage(
    page = this.query().page,
    status = this.query().status,
    queue = this.query().queue,
    afterWrite = false,
  ): void {
    const nextQuery: RenewalListQuery = { page, status, queue };
    if (sameQueryParams(this.serializeQuery(this.query()), this.serializeQuery(nextQuery))) {
      this.afterWrite = afterWrite;
      this.load();
      return;
    }
    this.afterWrite = afterWrite;
    this.patchQuery(nextQuery);
  }

  refreshPage(afterWrite = true): void {
    this.afterWrite = afterWrite;
    this.load();
  }

  setStatus(value: string | number | null): void {
    const status = value === '' || value === null ? null : (Number(value) as RenewalStatus);
    this.patchQuery({ status }, { resetPage: true });
  }

  clearQueue(): void {
    this.patchQuery({ queue: null }, { resetPage: true });
  }
}
