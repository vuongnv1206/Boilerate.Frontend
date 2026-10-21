import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  defer,
  filter,
  finalize,
  forkJoin,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { ApiError } from '@core/http/api-error';
import { OrdersService } from '@services/orders.service';
import {
  AfterSalesSummary,
  ConfirmPaymentRequest,
  ConfirmRefundRequest,
  DeliverShipmentRequest,
  DispatchShipmentRequest,
  OrderDto,
  OrderFulfillmentStatus,
  OrderHistoryEntry,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
  ProductFulfillmentKind,
  ShipmentSummary,
  ShipmentStatus,
  ReceiveReturnRequest,
  RefundResult,
  ReturnResult,
} from '@models/order.dto';
import { AuthSession } from '@core/auth/auth-session';

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
  private readonly shippingFailureState = signal<'rejected' | 'uncertain' | null>(null);
  private readonly relatedLoadingState = signal(false);
  private readonly shippingErrorState = signal('');
  private readonly afterSalesErrorState = signal('');
  private readonly afterSalesActionErrorState = signal('');
  private readonly afterSalesActionFailureState = signal<'rejected' | 'uncertain' | null>(null);
  private readonly afterSalesBusyState = signal(false);
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
  readonly shippingFailure = this.shippingFailureState.asReadonly();
  readonly relatedLoading = this.relatedLoadingState.asReadonly();
  readonly shippingError = this.shippingErrorState.asReadonly();
  readonly afterSalesError = this.afterSalesErrorState.asReadonly();
  readonly afterSalesActionError = this.afterSalesActionErrorState.asReadonly();
  readonly afterSalesActionFailure = this.afterSalesActionFailureState.asReadonly();
  readonly afterSalesBusy = this.afterSalesBusyState.asReadonly();
  readonly canViewShipping = computed(() => this.session.can('Shipping', 'View'));
  readonly canViewAfterSales = computed(() => this.session.can('AfterSales', 'View'));
  readonly canViewRenewals = computed(() => this.session.can('Renewal', 'View'));
  readonly canAdjustInventory = computed(() => this.session.can('Inventory', 'Adjust'));
  readonly shipments = this.shipmentsState.asReadonly();
  readonly afterSales = this.afterSalesState.asReadonly();
  readonly dispatchableLines = computed(() => {
    const order = this.order();
    const shipments = this.shipments();
    if (!order || shipments === null) return [];

    const shippedByItem = new Map<string, number>();
    for (const shipment of shipments) {
      for (const line of shipment.items) {
        shippedByItem.set(
          line.orderItemId,
          (shippedByItem.get(line.orderItemId) ?? 0) + line.quantity,
        );
      }
    }

    return order.items
      .filter((item) => item.fulfillmentKind === ProductFulfillmentKind.Physical)
      .map((item) => ({
        orderItem: item,
        remaining: item.quantity - (shippedByItem.get(item.id) ?? 0),
      }))
      .filter((line) => line.remaining > 0);
  });
  readonly canDispatch = computed(() => {
    const order = this.order();
    return (
      order !== null &&
      this.session.can('Shipping', 'Dispatch') &&
      this.session.can('Shipping', 'View') &&
      this.shipments() !== null &&
      !this.relatedLoading() &&
      !this.shippingError() &&
      order.status !== OrderStatus.Cancelled &&
      order.status !== OrderStatus.Expired &&
      order.status !== OrderStatus.Closed &&
      order.fulfillmentStatus !== OrderFulfillmentStatus.NeedsReview &&
      (order.paymentStatus === OrderPaymentStatus.Paid ||
        order.paymentMethod === OrderPaymentMethod.CashOnDelivery) &&
      this.dispatchableLines().length > 0
    );
  });
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
    if (!preserveActionState) this.shippingFailureState.set(null);
    if (!preserveActionState) {
      this.afterSalesActionErrorState.set('');
      this.afterSalesActionFailureState.set(null);
    }
    this.loads.next({ id, sequence });
  }

  reload(): void {
    if (this.activeOrderId) this.load(this.activeOrderId);
  }

  cancel(): void {
    const order = this.order();
    if (!order || !this.session.can('Order', 'Cancel') || !this.canCancel()) return;
    this.mutate(this.service.cancel(order.id, order.version), order.id);
  }

  confirmPayment(request: ConfirmPaymentRequest): void {
    const order = this.order();
    if (!order || !this.session.can('Payment', 'Confirm')) return;
    this.mutate(this.service.confirmPayment(order.id, request), order.id);
  }

  retryFulfillment(): void {
    const order = this.order();
    if (!order || !this.session.can('Order', 'Fulfill') || !this.canRetryFulfillment()) return;
    this.mutate(this.service.retryFulfillment(order.id, order.version), order.id);
  }

  dispatchShipment(request: DispatchShipmentRequest, replay = false): Observable<ShipmentSummary> {
    return defer(() => {
      const order = this.order();
      if (
        !order ||
        this.actionBusy() ||
        !this.session.can('Shipping', 'Dispatch') ||
        !this.canViewShipping() ||
        (!replay && !this.canDispatch())
      )
        return EMPTY;
      return this.mutateShipment(this.service.dispatchShipment(order.id, request), order.id);
    });
  }

  deliverShipment(
    shipment: ShipmentSummary,
    request: DeliverShipmentRequest,
    replay = false,
  ): Observable<ShipmentSummary> {
    return defer(() => {
      const order = this.order();
      if (
        !order ||
        this.actionBusy() ||
        !this.session.can('Shipping', 'Deliver') ||
        !this.canViewShipping() ||
        shipment.orderId !== order.id ||
        (!replay && shipment.status !== ShipmentStatus.Dispatched)
      )
        return EMPTY;
      return this.mutateShipment(
        this.service.deliverShipment(order.id, shipment.id, request),
        order.id,
      );
    });
  }

  confirmRefund(request: ConfirmRefundRequest, replay = false): Observable<RefundResult> {
    return defer(() => {
      const order = this.order();
      const afterSales = this.afterSales();
      if (
        !order ||
        this.afterSalesBusy() ||
        !this.canViewAfterSales() ||
        !this.session.can('Refund', 'Confirm') ||
        (!replay &&
          (!afterSales ||
            afterSales.closed ||
            request.amount > afterSales.refundableAmount ||
            order.paymentStatus !== OrderPaymentStatus.Paid))
      )
        return EMPTY;
      return this.mutateAfterSales(this.service.confirmRefund(order.id, request), order.id);
    });
  }

  receiveReturn(request: ReceiveReturnRequest, replay = false): Observable<ReturnResult> {
    return defer(() => {
      const order = this.order();
      const afterSales = this.afterSales();
      if (
        !order ||
        this.afterSalesBusy() ||
        !afterSales ||
        !this.canViewAfterSales() ||
        !this.session.can('Return', 'Receive') ||
        !this.canViewShipping() ||
        !this.shipments() ||
        (!replay && afterSales.closed) ||
        (request.items.some((item) => item.restockQuantity > 0) && !this.canAdjustInventory())
      )
        return EMPTY;
      return this.mutateAfterSales(this.service.receiveReturn(order.id, request), order.id);
    });
  }

  clearAfterSalesActionError(): void {
    this.afterSalesActionErrorState.set('');
    this.afterSalesActionFailureState.set(null);
  }

  canDeliverShipment(shipment: ShipmentSummary): boolean {
    return (
      this.session.can('Shipping', 'Deliver') &&
      this.session.can('Shipping', 'View') &&
      shipment.status === ShipmentStatus.Dispatched
    );
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

  private mutateShipment(
    request: Observable<ShipmentSummary>,
    orderId: string,
  ): Observable<ShipmentSummary> {
    const mutationSequence = ++this.mutationSequence;
    this.actionBusyState.set(true);
    this.actionErrorState.set('');
    this.conflictState.set(false);
    this.shippingFailureState.set(null);
    return request.pipe(
      filter(() => this.isCurrent(orderId) && mutationSequence === this.mutationSequence),
      tap(() => this.load(orderId)),
      catchError((error: unknown) => {
        if (!this.isCurrent(orderId) || mutationSequence !== this.mutationSequence) return EMPTY;
        this.shippingFailureState.set(
          error instanceof ApiError && error.status > 0 && error.status < 500
            ? 'rejected'
            : 'uncertain',
        );
        if (error instanceof ApiError && error.status === 409) {
          this.conflictState.set(true);
          this.actionErrorState.set(
            'Đơn hàng hoặc shipment đã thay đổi ở nơi khác. Dữ liệu đã được tải lại; hãy kiểm tra trước khi gửi lại.',
          );
          this.load(orderId, true);
        } else {
          this.actionErrorState.set(
            error instanceof ApiError ? error.message : 'Không thể cập nhật vận chuyển.',
          );
        }
        return EMPTY;
      }),
      finalize(() => {
        if (this.isCurrent(orderId) && mutationSequence === this.mutationSequence)
          this.actionBusyState.set(false);
      }),
      takeUntilDestroyed(this.destroyRef),
    );
  }

  private mutateAfterSales<T extends RefundResult | ReturnResult>(
    request: Observable<T>,
    orderId: string,
  ): Observable<T> {
    this.afterSalesBusyState.set(true);
    this.afterSalesActionErrorState.set('');
    this.afterSalesActionFailureState.set(null);
    return request.pipe(
      filter(() => this.isCurrent(orderId)),
      tap(() => this.load(orderId)),
      catchError((error: unknown) => {
        if (!this.isCurrent(orderId)) return EMPTY;
        const status = error instanceof ApiError ? error.status : 0;
        this.afterSalesActionFailureState.set(
          status > 0 && status < 500 ? 'rejected' : 'uncertain',
        );
        this.afterSalesActionErrorState.set(
          error instanceof ApiError
            ? error.message
            : 'Chưa nhận được kết quả từ máy chủ. Hãy thử lại cùng yêu cầu.',
        );
        if (status === 409) {
          this.conflictState.set(true);
          this.load(orderId, true);
        }
        return EMPTY;
      }),
      finalize(() => this.afterSalesBusyState.set(false)),
      takeUntilDestroyed(this.destroyRef),
    );
  }

  private isCurrent(id: string, sequence?: number): boolean {
    return this.activeOrderId === id && (sequence === undefined || sequence === this.loadSequence);
  }
}
