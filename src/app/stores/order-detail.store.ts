import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiError } from '@core/http/api-error';
import { OrdersService } from '@services/orders.service';
import {
  AfterSalesSummary,
  ConfirmPaymentRequest,
  OrderDto,
  OrderFulfillmentStatus,
  OrderHistoryEntry,
  OrderPaymentStatus,
  OrderStatus,
  ShipmentSummary,
} from '@models/order.dto';
import { AuthSession } from '@core/auth/auth-session';
import { ORDER_PERMISSIONS } from '@constants/order.constants';

@Injectable()
export class OrderDetailStore {
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(OrdersService);
  private readonly session = inject(AuthSession);
  private readonly loads = new Subject<{ id: string; sequence: number }>();
  private readonly orderState = signal<OrderDto | null>(null);
  private readonly historyState = signal<readonly OrderHistoryEntry[]>([]);
  private readonly loadingState = signal(false);
  private readonly historyLoadingState = signal(false);
  private readonly historyErrorState = signal('');
  private readonly errorState = signal('');
  private readonly actionErrorState = signal('');
  private readonly actionBusyState = signal(false);
  private readonly conflictState = signal(false);
  private readonly relatedLoadingState = signal(false);
  private readonly shippingErrorState = signal('');
  private readonly afterSalesErrorState = signal('');
  private readonly shipmentsState = signal<readonly ShipmentSummary[] | null>(null);
  private readonly afterSalesState = signal<AfterSalesSummary | null>(null);
  private activeOrderId: string | null = null;
  private loadSequence = 0;
  private mutationSequence = 0;
  readonly order = this.orderState.asReadonly();
  readonly history = this.historyState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly historyLoading = this.historyLoadingState.asReadonly();
  readonly historyError = this.historyErrorState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly actionError = this.actionErrorState.asReadonly();
  readonly actionBusy = this.actionBusyState.asReadonly();
  readonly conflict = this.conflictState.asReadonly();
  readonly relatedLoading = this.relatedLoadingState.asReadonly();
  readonly shippingError = this.shippingErrorState.asReadonly();
  readonly afterSalesError = this.afterSalesErrorState.asReadonly();
  readonly canViewShipping = computed(() =>
    this.session.hasPermission(ORDER_PERMISSIONS.shippingView),
  );
  readonly canViewAfterSales = computed(() =>
    this.session.hasPermission(ORDER_PERMISSIONS.afterSalesView),
  );
  readonly shipments = this.shipmentsState.asReadonly();
  readonly afterSales = this.afterSalesState.asReadonly();
  readonly canCancel = computed(() => {
    const order = this.order();
    return (
      order !== null &&
      (order.status === OrderStatus.PendingPayment ||
        order.status === OrderStatus.AwaitingProcessing) &&
      order.paymentStatus === OrderPaymentStatus.Unpaid &&
      !order.physicalDispatchStarted
    );
  });
  readonly canRetryFulfillment = computed(() => {
    const order = this.order();
    return (
      order !== null &&
      order.paymentStatus === OrderPaymentStatus.Paid &&
      order.status !== OrderStatus.Cancelled &&
      order.status !== OrderStatus.Closed &&
      order.fulfillmentStatus === OrderFulfillmentStatus.NeedsReview &&
      !order.physicalDispatchStarted
    );
  });

  constructor() {
    this.loads
      .pipe(
        switchMap(({ id, sequence }) =>
          this.service.get(id).pipe(
            catchError((error: unknown) => {
              if (this.isCurrent(id, sequence))
                this.errorState.set(
                  error instanceof ApiError ? error.message : 'Không thể tải chi tiết đơn hàng.',
                );
              return of(null);
            }),
            finalize(() => {
              if (this.isCurrent(id, sequence)) this.loadingState.set(false);
            }),
            map((order) => ({ id, sequence, order })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ id, sequence, order }) => {
        if (!this.isCurrent(id, sequence)) return;
        if (order) {
          this.orderState.set(order);
          this.loadHistory(order.id, sequence);
          this.loadRelated(order.id, sequence);
        }
      });
    this.destroyRef.onDestroy(() => this.loads.complete());
  }

  load(id: string, preserveActionState = false): void {
    this.activeOrderId = id;
    const sequence = ++this.loadSequence;
    this.mutationSequence++;
    const actionError = preserveActionState ? this.actionError() : '';
    const conflict = preserveActionState && this.conflict();
    this.loadingState.set(true);
    this.errorState.set('');
    this.orderState.set(null);
    this.historyState.set([]);
    this.historyLoadingState.set(false);
    this.historyErrorState.set('');
    this.relatedLoadingState.set(false);
    this.shipmentsState.set(null);
    this.shippingErrorState.set('');
    this.afterSalesState.set(null);
    this.afterSalesErrorState.set('');
    this.actionBusyState.set(false);
    this.actionErrorState.set(actionError);
    this.conflictState.set(conflict);
    this.loads.next({ id, sequence });
  }

  reload(): void {
    const order = this.order();
    if (order) this.load(order.id);
  }

  cancel(): void {
    const order = this.order();
    if (!order || !this.canCancel()) return;
    this.mutate(this.service.cancel(order.id, order.version), order.id);
  }

  confirmPayment(request: ConfirmPaymentRequest): void {
    const order = this.order();
    if (!order) return;
    this.mutate(this.service.confirmPayment(order.id, request), order.id);
  }

  retryFulfillment(): void {
    const order = this.order();
    if (!order || !this.canRetryFulfillment()) return;
    this.mutate(this.service.retryFulfillment(order.id, order.version), order.id);
  }

  clearActionError(): void {
    this.actionErrorState.set('');
    this.conflictState.set(false);
  }

  reloadHistory(): void {
    const order = this.order();
    if (order) this.loadHistory(order.id, this.loadSequence);
  }

  reloadRelated(): void {
    const order = this.order();
    if (order) this.loadRelated(order.id, this.loadSequence);
  }

  private loadHistory(id: string, sequence: number): void {
    if (!this.isCurrent(id, sequence)) return;
    this.historyLoadingState.set(true);
    this.historyErrorState.set('');
    this.service
      .history(id)
      .pipe(
        catchError((error: unknown) => {
          if (this.isCurrent(id, sequence))
            this.historyErrorState.set(
              error instanceof ApiError ? error.message : 'Không thể tải timeline.',
            );
          return of(null);
        }),
        finalize(() => {
          if (this.isCurrent(id, sequence)) this.historyLoadingState.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((history) => {
        if (history && this.isCurrent(id, sequence)) this.historyState.set(history);
      });
  }

  private loadRelated(id: string, sequence: number): void {
    if (!this.isCurrent(id, sequence)) return;
    const hasShipping = this.canViewShipping();
    const hasAfterSales = this.canViewAfterSales();
    this.shipmentsState.set(null);
    this.shippingErrorState.set('');
    this.afterSalesState.set(null);
    this.afterSalesErrorState.set('');
    if (!hasShipping && !hasAfterSales) return;
    this.relatedLoadingState.set(true);
    forkJoin({
      shipments: hasShipping
        ? this.service.shipments(id).pipe(
            catchError((error: unknown) => {
              if (this.isCurrent(id, sequence))
                this.shippingErrorState.set(
                  error instanceof ApiError ? error.message : 'Không thể tải shipment.',
                );
              return of(null as readonly ShipmentSummary[] | null);
            }),
          )
        : of(null),
      afterSales: hasAfterSales
        ? this.service.afterSales(id).pipe(
            catchError((error: unknown) => {
              if (this.isCurrent(id, sequence))
                this.afterSalesErrorState.set(
                  error instanceof ApiError ? error.message : 'Không thể tải after-sales.',
                );
              return of(null as AfterSalesSummary | null);
            }),
          )
        : of(null),
    })
      .pipe(
        finalize(() => {
          if (this.isCurrent(id, sequence)) this.relatedLoadingState.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((related) => {
        if (!this.isCurrent(id, sequence)) return;
        this.shipmentsState.set(related.shipments);
        this.afterSalesState.set(related.afterSales);
      });
  }

  private mutate(request: ReturnType<OrdersService['cancel']>, orderId: string): void {
    const mutationSequence = ++this.mutationSequence;
    this.actionBusyState.set(true);
    this.actionErrorState.set('');
    this.conflictState.set(false);
    request
      .pipe(
        catchError((error: unknown) => {
          if (!this.isCurrent(orderId) || mutationSequence !== this.mutationSequence)
            return of(null);
          if (error instanceof ApiError && error.status === 409) {
            this.conflictState.set(true);
            this.actionErrorState.set(
              'Đơn hàng đã thay đổi ở nơi khác. Màn hình đã được tải lại; hãy kiểm tra lại trước khi thao tác tiếp.',
            );
          } else {
            this.actionErrorState.set(
              error instanceof ApiError ? error.message : 'Không thể hoàn tất thao tác.',
            );
          }
          return of(null);
        }),
        finalize(() => {
          if (this.isCurrent(orderId) && mutationSequence === this.mutationSequence)
            this.actionBusyState.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((order) => {
        if (!this.isCurrent(orderId) || mutationSequence !== this.mutationSequence) return;
        if (order) {
          this.orderState.set(order);
          this.loadHistory(order.id, this.loadSequence);
          this.loadRelated(order.id, this.loadSequence);
        } else if (this.conflict()) {
          this.load(orderId, true);
        }
      });
  }

  private isCurrent(id: string, sequence?: number): boolean {
    return this.activeOrderId === id && (sequence === undefined || sequence === this.loadSequence);
  }
}
