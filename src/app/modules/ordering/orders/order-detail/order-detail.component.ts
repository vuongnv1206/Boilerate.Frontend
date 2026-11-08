import {
  Component,
  HostListener,
  Optional,
  OnInit,
  computed,
  effect,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Subscription, catchError, finalize, of } from 'rxjs';
import { BaseComponent, LeaveConfirmation } from '@core/base';
import { ApiError } from '@core/http/api-error';
import { OrderAfterSalesPanel } from '@modules/after-sales';
import { OrderPaymentPanel } from '@modules/payments';
import { OrderRenewalsPanel } from '@modules/renewals';
import { OrderShipmentsPanel, ShipmentDto } from '@modules/shipping';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  ORDER_FULFILLMENT_STATUS_LABELS,
  ORDER_PAYMENT_METHOD_LABELS,
  ORDER_PAYMENT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  OrderDto,
  OrderHistoryEntry,
  OrderPanelFailureEvent,
  OrderPanelMutationEvent,
  OrderPaymentStatus,
  OrderStatus,
  PRODUCT_FULFILLMENT_OPTIONS,
  orderListQueryParams,
  readOrderListQuery,
} from '../../models/order.dto';
import { OrdersService } from '../../services/orders.service';
import { OrdersWorkspace } from '../orders-workspace.component';

@Component({
  selector: 'app-order-detail',
  host: { class: 'collection-screen' },
  imports: [
    SHARED_IMPORTS,
    OrderPaymentPanel,
    OrderShipmentsPanel,
    OrderAfterSalesPanel,
    OrderRenewalsPanel,
  ],
  providers: [LeaveConfirmation],
  templateUrl: './order-detail.component.html',
})
export class OrderDetail extends BaseComponent implements OnInit {
  // System variables
  private readonly shipmentsPanel = viewChild(OrderShipmentsPanel);
  private readonly afterSalesPanel = viewChild(OrderAfterSalesPanel);
  private orderSub: Subscription | null = null;
  private historySub: Subscription | null = null;
  private cancelSub: Subscription | null = null;
  private activeOrderId: string | null = null;
  private loadSequence = 0;

  // Business variables
  readonly order = signal<OrderDto | null>(null);
  readonly history = signal<readonly OrderHistoryEntry[]>([]);
  readonly historyLoading = signal(false);
  readonly historyError = signal('');
  readonly actionError = signal('');
  readonly cancelDialog = signal(false);
  readonly cancelBusy = signal(false);
  readonly paymentBusy = signal(false);
  readonly shippingBusy = signal(false);
  readonly afterSalesBusy = signal(false);
  readonly shipments = signal<readonly ShipmentDto[] | null>(null);

  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly paymentStatusLabels = ORDER_PAYMENT_STATUS_LABELS;
  readonly fulfillmentStatusLabels = ORDER_FULFILLMENT_STATUS_LABELS;
  readonly paymentMethodLabels = ORDER_PAYMENT_METHOD_LABELS;
  readonly status = OrderStatus;

  readonly anyBusy = computed(
    () => this.cancelBusy() || this.paymentBusy() || this.shippingBusy() || this.afterSalesBusy(),
  );
  readonly canCancelOrder = computed(() => {
    const current = this.order();
    return (
      current !== null &&
      (current.status === OrderStatus.PendingPayment ||
        current.status === OrderStatus.AwaitingProcessing) &&
      current.paymentStatus === OrderPaymentStatus.Unpaid &&
      !current.physicalDispatchStarted
    );
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly ordersService: OrdersService,
    readonly confirmation: LeaveConfirmation,
    @Optional() private readonly workspace?: OrdersWorkspace,
  ) {
    super();
    this.destroyRef.onDestroy(() => {
      this.orderSub?.unsubscribe();
      this.historySub?.unsubscribe();
      this.cancelSub?.unsubscribe();
    });
    effect(() => {
      const current = this.order();
      if (current) {
        untracked(() => this.workspace?.updateVisibleOrder(current));
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.activeOrderId = id;
        this.loadOrder(id);
      }
    });
  }

  canCancelPermission(): boolean {
    return this.can('Order', 'Cancel');
  }

  backQuery(): Record<string, string | number> {
    return orderListQueryParams(readOrderListQuery(this.route.snapshot.queryParams));
  }

  fulfillmentLabel(value: number): string {
    return PRODUCT_FULFILLMENT_OPTIONS.find((option) => option.value === value)?.label ?? '—';
  }

  reload(): void {
    if (this.activeOrderId) this.loadOrder(this.activeOrderId);
  }

  reloadHistory(): void {
    const current = this.order();
    if (current) this.loadHistory(current.id, this.loadSequence);
  }

  clearActionError(): void {
    this.actionError.set('');
  }

  onPaymentOrderUpdated(updated: unknown): void {
    const nextOrder = updated as OrderDto;
    if (this.activeOrderId !== nextOrder.id) return;
    this.actionError.set('');
    this.order.set(nextOrder);
    this.loadHistory(nextOrder.id, this.loadSequence);
  }

  onPanelActionFailed(failure: OrderPanelFailureEvent): void {
    this.actionError.set(failure.message);
    if (failure.conflict && this.activeOrderId) {
      this.refreshOrder(this.activeOrderId, true);
    }
  }

  onSubpanelMutated(event: OrderPanelMutationEvent): void {
    if (this.activeOrderId) {
      this.refreshOrder(this.activeOrderId, event.preserveActionState);
    }
  }

  onRenewalsMutated(): void {
    if (this.activeOrderId) {
      this.refreshOrder(this.activeOrderId, false);
    }
  }

  confirmCancel(): void {
    this.cancelDialog.set(false);
    const current = this.order();
    if (!current || !this.canCancelPermission() || !this.canCancelOrder() || this.anyBusy()) {
      return;
    }
    const orderId = current.id;
    this.cancelSub?.unsubscribe();
    this.cancelBusy.set(true);
    this.actionError.set('');
    this.cancelSub = this.ordersService
      .cancelAdminOrder(orderId, current.version)
      .pipe(
        finalize(() => this.cancelBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          if (this.activeOrderId !== orderId) return;
          this.order.set(updated);
          this.loadHistory(updated.id, this.loadSequence);
        },
        error: (error: unknown) => {
          if (this.activeOrderId !== orderId) return;
          if (error instanceof ApiError && error.status === 409) {
            this.actionError.set(
              'Đơn hàng đã thay đổi ở nơi khác. Màn hình đã được tải lại; hãy kiểm tra lại trước khi thao tác tiếp.',
            );
            this.refreshOrder(orderId, true);
            return;
          }
          this.actionError.set(
            error instanceof ApiError ? error.message : 'Không thể hoàn tất thao tác.',
          );
        },
      });
  }

  confirmLeave(): boolean | Promise<boolean> {
    const hasDraft =
      (this.shipmentsPanel()?.hasUnsavedDraft() ?? false) ||
      (this.afterSalesPanel()?.hasUnsavedDraft() ?? false);
    return this.confirmation.request(hasDraft, this.anyBusy());
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    const hasDraft =
      (this.shipmentsPanel()?.hasUnsavedDraft() ?? false) ||
      (this.afterSalesPanel()?.hasUnsavedDraft() ?? false);
    if (hasDraft || this.anyBusy()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  private loadOrder(id: string): void {
    const sequence = ++this.loadSequence;
    this.orderSub?.unsubscribe();
    this.historySub?.unsubscribe();
    this.loading.set(true);
    this.errorMessage.set('');
    this.actionError.set('');
    this.order.set(null);
    this.shipments.set(null);
    this.history.set([]);
    this.historyError.set('');
    this.orderSub = this.ordersService
      .getById(id)
      .pipe(
        catchError((error: unknown) => {
          if (this.activeOrderId === id && sequence === this.loadSequence) {
            this.errorMessage.set(
              error instanceof ApiError ? error.message : 'Không thể tải chi tiết đơn hàng.',
            );
          }
          return of(null);
        }),
        finalize(() => {
          if (this.activeOrderId === id && sequence === this.loadSequence) {
            this.loading.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((loaded) => {
        if (!loaded || this.activeOrderId !== id || sequence !== this.loadSequence) return;
        this.order.set(loaded);
        this.loadHistory(loaded.id, sequence);
      });
  }

  private refreshOrder(id: string, preserveActionState: boolean): void {
    const sequence = ++this.loadSequence;
    this.orderSub?.unsubscribe();
    if (!preserveActionState) this.actionError.set('');
    this.orderSub = this.ordersService
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (loaded) => {
          if (this.activeOrderId !== id || sequence !== this.loadSequence) return;
          this.order.set(loaded);
          this.loadHistory(loaded.id, sequence);
        },
        error: (error: unknown) => {
          if (this.activeOrderId !== id || sequence !== this.loadSequence) return;
          if (!preserveActionState) {
            this.actionError.set(
              error instanceof ApiError ? error.message : 'Không thể tải lại chi tiết đơn hàng.',
            );
          }
        },
      });
  }

  private loadHistory(id: string, sequence: number): void {
    this.historySub?.unsubscribe();
    this.historyLoading.set(true);
    this.historyError.set('');
    this.historySub = this.ordersService
      .getHistory(id)
      .pipe(
        catchError((error: unknown) => {
          if (this.activeOrderId === id && sequence === this.loadSequence) {
            this.historyError.set(
              error instanceof ApiError ? error.message : 'Không thể tải timeline.',
            );
          }
          return of(null);
        }),
        finalize(() => {
          if (this.activeOrderId === id && sequence === this.loadSequence) {
            this.historyLoading.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((entries) => {
        if (entries && this.activeOrderId === id && sequence === this.loadSequence) {
          this.history.set(entries);
        }
      });
  }
}
