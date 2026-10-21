import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { StatusBadge } from '@shared/ui/status-badge/status-badge.component';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog.component';
import { LeaveConfirmation } from '@shared/ui/confirm-dialog/leave-confirmation';
import { AuthSession } from '@core/auth/auth-session';
import { OrderDetailStore } from '@stores/order-detail.store';
import {
  ConfirmPaymentRequest,
  ConfirmRefundRequest,
  DeliverShipmentRequest,
  DispatchShipmentRequest,
  OrderDto,
  OrderFulfillmentStatus,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
  ProductFulfillmentKind,
  ReceiveReturnRequest,
  ReturnLineInput,
  ShipmentStatus,
  ShipmentSummary,
} from '@models/order.dto';
import {
  ORDER_FULFILLMENT_STATUS_LABELS,
  ORDER_PAYMENT_METHOD_LABELS,
  ORDER_PAYMENT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  SHIPMENT_STATUS_LABELS,
} from '@constants/order.constants';
import { orderListQueryParams, readOrderListQuery } from '@utils/order-query.util';

@Component({
  selector: 'app-order-detail',
  imports: [
    RouterLink,
    ContentState,
    Icon,
    StatusBadge,
    CurrencyPipe,
    DatePipe,
    Dialog,
    FormsModule,
    InputText,
    ConfirmDialog,
  ],
  providers: [OrderDetailStore, LeaveConfirmation],
  templateUrl: './order-detail.component.html',
  styleUrl: '../../../styles/admin/_orders.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(AuthSession);
  readonly store = inject(OrderDetailStore);
  readonly confirmation = inject(LeaveConfirmation);
  readonly cancelDialog = signal(false);
  readonly paymentDialog = signal(false);
  readonly paymentSubmitted = signal(false);
  readonly paymentReference = signal('');
  readonly paymentAmount = signal(0);
  readonly paymentCurrency = signal('VND');
  readonly paymentReceivedAt = signal('');
  readonly paymentSource = signal<'ManualBankTransfer' | 'ManualCOD'>('ManualBankTransfer');
  readonly dispatchDialog = signal(false);
  readonly dispatchCarrier = signal('');
  readonly dispatchTrackingNumber = signal('');
  readonly dispatchQuantities = signal<Record<string, number>>({});
  readonly pendingDispatch = signal<DispatchShipmentRequest | null>(null);
  readonly dispatchNotice = signal('');
  readonly deliveryTarget = signal<ShipmentSummary | null>(null);
  readonly pendingDeliveries = signal<Record<string, DeliverShipmentRequest>>({});
  readonly refundFormOpen = signal(false);
  readonly refundReference = signal('');
  readonly refundAmount = signal<number | null>(null);
  readonly refundReason = signal('');
  readonly refundSource = signal<'ManualBankTransfer' | 'ManualCash'>('ManualBankTransfer');
  readonly refundAt = signal('');
  readonly refundDirty = signal(false);
  readonly pendingRefund = signal<ConfirmRefundRequest | null>(null);
  readonly returnFormOpen = signal(false);
  readonly returnReference = signal('');
  readonly returnReason = signal('');
  readonly returnQuantities = signal<Record<string, number>>({});
  readonly restockQuantities = signal<Record<string, number>>({});
  readonly closeRemainingCod = signal(false);
  readonly returnDirty = signal(false);
  readonly pendingReturn = signal<ReceiveReturnRequest | null>(null);
  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly paymentStatusLabels = ORDER_PAYMENT_STATUS_LABELS;
  readonly fulfillmentStatusLabels = ORDER_FULFILLMENT_STATUS_LABELS;
  readonly paymentMethodLabels = ORDER_PAYMENT_METHOD_LABELS;
  readonly paymentMethod = OrderPaymentMethod;
  readonly shipmentStatusLabels = SHIPMENT_STATUS_LABELS;
  readonly status = OrderStatus;
  readonly paymentStatus = OrderPaymentStatus;
  readonly fulfillmentStatus = OrderFulfillmentStatus;
  readonly shipmentStatus = ShipmentStatus;
  private activeOrderId: string | null = null;

  constructor() {
    effect(() => {
      const order = this.store.order();
      if (
        this.paymentDialog() &&
        this.paymentSubmitted() &&
        !this.store.actionBusy() &&
        !this.store.actionError() &&
        order
      ) {
        this.paymentDialog.set(false);
        this.paymentSubmitted.set(false);
      }

      if (
        order &&
        this.store.shipments() !== null &&
        !this.store.relatedLoading() &&
        !this.store.actionBusy() &&
        !this.pendingDispatch()
      )
        this.reconcileDispatchDraft();
    });
  }

  canCancel(): boolean {
    return this.session.can('Order', 'Cancel');
  }

  canConfirmPayment(): boolean {
    return this.session.can('Payment', 'Confirm');
  }

  canFulfill(): boolean {
    return this.session.can('Order', 'Fulfill');
  }

  canDispatch(): boolean {
    return this.session.can('Shipping', 'Dispatch') && this.session.can('Shipping', 'View');
  }

  canRefund(): boolean {
    return this.store.canViewAfterSales() && this.session.can('Refund', 'Confirm');
  }

  canReceiveReturn(): boolean {
    return (
      this.store.canViewAfterSales() &&
      this.store.canViewShipping() &&
      this.session.can('Return', 'Receive')
    );
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        if (this.activeOrderId !== id) this.resetShippingDraft();
        this.activeOrderId = id;
        this.store.load(id);
      }
    });
  }

  backQuery(): Record<string, string | number> {
    return orderListQueryParams(readOrderListQuery(this.route.snapshot.queryParams));
  }

  openPayment(): void {
    const order = this.store.order();
    if (!order) return;
    this.paymentReference.set('');
    this.paymentAmount.set(order.total);
    this.paymentCurrency.set(order.currency);
    this.paymentReceivedAt.set(this.toLocalDateTime(order.paidAtUtc ?? new Date().toISOString()));
    this.paymentSource.set(
      order.paymentMethod === OrderPaymentMethod.CashOnDelivery
        ? 'ManualCOD'
        : 'ManualBankTransfer',
    );
    this.paymentSubmitted.set(false);
    this.store.clearActionError();
    this.paymentDialog.set(true);
  }

  submitPayment(): void {
    if (!this.canConfirmPayment()) return;
    const order = this.store.order();
    if (!order || !this.paymentReference().trim() || !this.paymentReceivedAt()) return;
    const request: ConfirmPaymentRequest = {
      version: order.version,
      operationId: crypto.randomUUID(),
      reference: this.paymentReference().trim(),
      amount: this.paymentAmount(),
      currency: this.paymentCurrency().trim(),
      receivedAtUtc: new Date(this.paymentReceivedAt()).toISOString(),
      source: this.paymentSource(),
    };
    this.paymentSubmitted.set(true);
    this.store.confirmPayment(request);
  }

  confirmCancel(): void {
    if (!this.canCancel()) return;
    this.cancelDialog.set(false);
    this.store.cancel();
  }

  retryFulfillment(): void {
    if (!this.canFulfill()) return;
    this.store.retryFulfillment();
  }

  openDispatch(): void {
    if (!this.canDispatch() || (!this.pendingDispatch() && !this.store.canDispatch())) return;
    if (Object.keys(this.dispatchQuantities()).length === 0) {
      this.dispatchQuantities.set(
        Object.fromEntries(
          this.store.dispatchableLines().map(({ orderItem }) => [orderItem.id, 0]),
        ),
      );
    }
    this.store.clearActionError();
    this.dispatchDialog.set(true);
  }

  setDispatchQuantity(orderItemId: string, value: number | string | null): void {
    if (this.dispatchLocked()) return;
    const quantity = Number(value);
    this.dispatchQuantities.update((current) => ({ ...current, [orderItemId]: quantity }));
  }

  dispatchCanSubmit(): boolean {
    if (this.pendingDispatch()) return this.canDispatch() && this.store.order() !== null;
    const carrier = this.dispatchCarrier().trim();
    const trackingNumber = this.dispatchTrackingNumber().trim();
    if (
      !this.store.canDispatch() ||
      !carrier ||
      carrier.length > 100 ||
      !trackingNumber ||
      trackingNumber.length > 100
    )
      return false;

    const remainingById = new Map(
      this.store.dispatchableLines().map(({ orderItem, remaining }) => [orderItem.id, remaining]),
    );
    const entries = Object.entries(this.dispatchQuantities());
    return (
      entries.filter(([, quantity]) => quantity > 0).length <= 50 &&
      entries.some(([id, quantity]) => quantity > 0 && remainingById.has(id)) &&
      entries.every(
        ([id, quantity]) =>
          quantity === 0 ||
          (Number.isInteger(quantity) &&
            quantity > 0 &&
            quantity <= this.maxDispatchQuantity(remainingById.get(id) ?? 0)),
      )
    );
  }

  maxDispatchQuantity(remaining: number): number {
    return Math.min(remaining, 999);
  }

  submitDispatch(): void {
    const order = this.store.order();
    if (!order || this.store.actionBusy() || !this.dispatchCanSubmit()) return;
    const pending = this.pendingDispatch();
    const items = Object.entries(this.dispatchQuantities())
      .filter(([, quantity]) => quantity > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (!pending && items.length === 0) return;
    const request: DispatchShipmentRequest = pending ?? {
      orderVersion: order.version,
      operationId: crypto.randomUUID(),
      carrier: this.dispatchCarrier().trim(),
      trackingNumber: this.dispatchTrackingNumber().trim(),
      items,
    };
    this.pendingDispatch.set(request);
    const orderId = order.id;
    this.store
      .dispatchShipment(request, pending !== null)
      .pipe(
        finalize(() => {
          if (
            this.activeOrderId === orderId &&
            this.pendingDispatch() === request &&
            this.store.shippingFailure() === 'rejected'
          )
            this.pendingDispatch.set(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.activeOrderId === orderId && this.pendingDispatch() === request)
          this.resetDispatchDraft();
      });
  }

  openDelivery(shipment: ShipmentSummary): void {
    if (!this.canDeliver()) return;
    if (!this.store.canDeliverShipment(shipment) && !this.pendingDeliveries()[shipment.id]) return;
    this.store.clearActionError();
    this.deliveryTarget.set(shipment);
  }

  submitDelivery(): void {
    const target = this.deliveryTarget();
    const order = this.store.order();
    if (!target || !order || !this.currentDeliveryCanSubmit()) return;
    const currentShipment = this.store.shipments()?.find((shipment) => shipment.id === target.id);
    const pending = this.pendingDeliveries()[target.id];
    if (!currentShipment || (!pending && !this.store.canDeliverShipment(currentShipment))) return;
    const request: DeliverShipmentRequest = pending ?? {
      orderVersion: order.version,
      version: currentShipment.version,
      operationId: crypto.randomUUID(),
    };
    this.pendingDeliveries.update((current) => ({
      ...current,
      [target.id]: request,
    }));
    const orderId = order.id;
    this.store
      .deliverShipment(currentShipment, request, !!pending)
      .pipe(
        finalize(() => {
          if (this.activeOrderId === orderId && this.store.shippingFailure() === 'rejected')
            this.clearPendingDelivery(target.id, request);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.activeOrderId !== orderId) return;
        this.clearPendingDelivery(target.id, request);
        if (this.deliveryTarget()?.id === target.id) this.deliveryTarget.set(null);
      });
  }

  currentDeliveryTarget(): ShipmentSummary | null {
    const target = this.deliveryTarget();
    if (!target) return null;
    return this.store.shipments()?.find((shipment) => shipment.id === target.id) ?? target;
  }

  canDeliver(): boolean {
    return this.session.can('Shipping', 'Deliver') && this.store.canViewShipping();
  }

  currentDeliveryCanSubmit(): boolean {
    const shipment = this.currentDeliveryTarget();
    return (
      this.store.order() !== null &&
      this.store.shipments() !== null &&
      !this.store.relatedLoading() &&
      !this.store.actionBusy() &&
      shipment !== null &&
      (this.store.canDeliverShipment(shipment) ||
        (!!this.pendingDeliveries()[shipment.id] &&
          this.session.can('Shipping', 'Deliver') &&
          this.store.canViewShipping()))
    );
  }

  onDeliveryDialogVisibility(visible: boolean): void {
    if (!visible) this.deliveryTarget.set(null);
  }

  openRefundForm(): void {
    if (!this.canRefund() || this.pendingRefund() || this.pendingReturn()) return;
    this.store.clearAfterSalesActionError();
    this.refundAt.set(this.toLocalDateTime(new Date().toISOString()));
    this.refundAmount.set(this.store.afterSales()?.refundableAmount ?? null);
    this.refundFormOpen.set(true);
  }

  closeRefundForm(): void {
    if (this.pendingRefund()) return;
    this.refundFormOpen.set(false);
    this.refundDirty.set(false);
  }

  markRefundDirty(): void {
    this.refundDirty.set(true);
  }

  refundCanSubmit(): boolean {
    const order = this.store.order();
    const summary = this.store.afterSales();
    const amount = this.refundAmount();
    const reference = this.refundReference().trim();
    const reason = this.refundReason().trim();
    const refundedAt = this.refundAt();
    return (
      !!order &&
      !!summary &&
      this.canRefund() &&
      !summary.closed &&
      order.paymentStatus === OrderPaymentStatus.Paid &&
      order.currency.toUpperCase() === 'VND' &&
      amount !== null &&
      Number.isInteger(amount) &&
      amount > 0 &&
      amount <= summary.refundableAmount &&
      /^[A-Za-z0-9._-]{1,100}$/.test(reference) &&
      reason.length > 0 &&
      reason.length <= 1000 &&
      !!refundedAt &&
      Number.isFinite(Date.parse(refundedAt)) &&
      Date.parse(refundedAt) <= Date.now()
    );
  }

  submitRefund(): void {
    const order = this.store.order();
    if (!order || this.store.afterSalesBusy()) return;
    const pending = this.pendingRefund();
    if (!pending && !this.refundCanSubmit()) return;
    const request = pending ?? {
      orderVersion: order.version,
      operationId: crypto.randomUUID(),
      reference: this.refundReference().trim(),
      amount: this.refundAmount() ?? 0,
      currency: 'VND' as const,
      refundedAtUtc: new Date(this.refundAt()).toISOString(),
      reason: this.refundReason().trim(),
      source: this.refundSource(),
    };
    this.pendingRefund.set(request);
    const orderId = order.id;
    this.store
      .confirmRefund(request, pending !== null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.pendingRefund() !== request) return;
          this.pendingRefund.set(null);
          this.refundFormOpen.set(false);
          this.refundReference.set('');
          this.refundAmount.set(null);
          this.refundReason.set('');
          this.refundAt.set('');
          this.refundDirty.set(false);
        },
        complete: () => {
          if (
            this.activeOrderId === orderId &&
            this.store.afterSalesActionFailure() === 'rejected' &&
            this.pendingRefund() === request
          )
            this.pendingRefund.set(null);
        },
      });
  }

  openReturnForm(): void {
    if (!this.canReceiveReturn() || this.pendingRefund() || this.pendingReturn()) return;
    this.store.clearAfterSalesActionError();
    this.returnQuantities.set({});
    this.restockQuantities.set({});
    this.closeRemainingCod.set(false);
    this.returnFormOpen.set(true);
  }

  closeReturnForm(): void {
    if (this.pendingReturn()) return;
    this.returnFormOpen.set(false);
    this.returnDirty.set(false);
  }

  markReturnDirty(): void {
    this.returnDirty.set(true);
  }

  returnLineKey(shipmentId: string, orderItemId: string): string {
    return `${shipmentId}:${orderItemId}`;
  }

  setReturnQuantity(shipmentId: string, orderItemId: string, value: number | string | null): void {
    if (this.pendingReturn()) return;
    const line = this.returnableLines().find(
      (item) => item.shipmentId === shipmentId && item.orderItemId === orderItemId,
    );
    const quantity = Number(value);
    const next = Number.isInteger(quantity)
      ? Math.max(0, Math.min(line?.remaining ?? 0, quantity))
      : 0;
    const key = this.returnLineKey(shipmentId, orderItemId);
    this.returnQuantities.update((current) => ({ ...current, [key]: next }));
    this.restockQuantities.update((current) => ({
      ...current,
      [key]: Math.min(current[key] ?? 0, next),
    }));
    this.returnDirty.set(true);
  }

  setRestockQuantity(shipmentId: string, orderItemId: string, value: number | string | null): void {
    if (this.pendingReturn()) return;
    const key = this.returnLineKey(shipmentId, orderItemId);
    const selected = this.returnQuantities()[key] ?? 0;
    const quantity = Number(value);
    const next = Number.isInteger(quantity) ? Math.max(0, Math.min(selected, quantity)) : 0;
    this.restockQuantities.update((current) => ({ ...current, [key]: next }));
    this.returnDirty.set(true);
  }

  returnableLines(): Array<{
    shipmentId: string;
    carrier: string;
    trackingNumber: string;
    orderItemId: string;
    name: string;
    sku: string;
    remaining: number;
  }> {
    const order = this.store.order();
    const shipments = this.store.shipments();
    const afterSales = this.store.afterSales();
    if (!order || !shipments || !afterSales) return [];
    const returned = new Map<string, number>();
    for (const existing of afterSales.returns)
      for (const item of existing.items) {
        const key = this.returnLineKey(item.shipmentId, item.orderItemId);
        returned.set(key, (returned.get(key) ?? 0) + item.quantity);
      }
    return shipments.flatMap((shipment) =>
      shipment.items.flatMap((line) => {
        const item = order.items.find((value) => value.id === line.orderItemId);
        const key = this.returnLineKey(shipment.id, line.orderItemId);
        const remaining = line.quantity - (returned.get(key) ?? 0);
        return item && item.fulfillmentKind === ProductFulfillmentKind.Physical && remaining > 0
          ? [
              {
                shipmentId: shipment.id,
                carrier: shipment.carrier,
                trackingNumber: shipment.trackingNumber,
                orderItemId: line.orderItemId,
                name: item.name,
                sku: item.sku,
                remaining,
              },
            ]
          : [];
      }),
    );
  }

  returnSelectionCompletesDispatched(): boolean {
    const lines = this.returnableLines();
    return (
      lines.length > 0 &&
      lines.every(
        (line) =>
          (this.returnQuantities()[this.returnLineKey(line.shipmentId, line.orderItemId)] ?? 0) ===
          line.remaining,
      )
    );
  }

  returnCanSubmit(): boolean {
    const order = this.store.order();
    const summary = this.store.afterSales();
    const items = this.buildReturnLines();
    const reference = this.returnReference().trim();
    const reason = this.returnReason().trim();
    return (
      !!order &&
      !!summary &&
      this.canReceiveReturn() &&
      !summary.closed &&
      /^[A-Za-z0-9._-]{1,100}$/.test(reference) &&
      reason.length > 0 &&
      reason.length <= 1000 &&
      items.length > 0 &&
      items.length <= 50 &&
      items.every(
        (item) =>
          item.quantity > 0 && item.restockQuantity >= 0 && item.restockQuantity <= item.quantity,
      ) &&
      (!items.some((item) => item.restockQuantity > 0) || this.store.canAdjustInventory()) &&
      (!this.closeRemainingCod() ||
        (order.paymentMethod === OrderPaymentMethod.CashOnDelivery &&
          order.paymentStatus === OrderPaymentStatus.Unpaid &&
          this.returnSelectionCompletesDispatched()))
    );
  }

  submitReturn(): void {
    const order = this.store.order();
    if (!order || this.store.afterSalesBusy()) return;
    const pending = this.pendingReturn();
    if (!pending && !this.returnCanSubmit()) return;
    const request = pending ?? {
      orderVersion: order.version,
      operationId: crypto.randomUUID(),
      reference: this.returnReference().trim(),
      reason: this.returnReason().trim(),
      items: this.buildReturnLines(),
      closeRemainingCod: this.closeRemainingCod(),
    };
    this.pendingReturn.set(request);
    const orderId = order.id;
    this.store
      .receiveReturn(request, pending !== null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.pendingReturn() !== request) return;
          this.pendingReturn.set(null);
          this.returnFormOpen.set(false);
          this.returnReference.set('');
          this.returnReason.set('');
          this.returnQuantities.set({});
          this.restockQuantities.set({});
          this.closeRemainingCod.set(false);
          this.returnDirty.set(false);
        },
        complete: () => {
          if (
            this.activeOrderId === orderId &&
            this.store.afterSalesActionFailure() === 'rejected' &&
            this.pendingReturn() === request
          )
            this.pendingReturn.set(null);
        },
      });
  }

  private buildReturnLines(): ReturnLineInput[] {
    return this.returnableLines().flatMap((line) => {
      const key = this.returnLineKey(line.shipmentId, line.orderItemId);
      const quantity = this.returnQuantities()[key] ?? 0;
      return quantity > 0
        ? [
            {
              shipmentId: line.shipmentId,
              orderItemId: line.orderItemId,
              quantity,
              restockQuantity: this.restockQuantities()[key] ?? 0,
            },
          ]
        : [];
    });
  }

  returnQuantity(receipt: { readonly items: readonly ReturnLineInput[] }): number {
    return receipt.items.reduce((total, item) => total + item.quantity, 0);
  }

  restockQuantity(receipt: { readonly items: readonly ReturnLineInput[] }): number {
    return receipt.items.reduce((total, item) => total + item.restockQuantity, 0);
  }

  dispatchLocked(): boolean {
    return this.pendingDispatch() !== null || this.store.actionBusy();
  }

  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(
      this.hasShippingDraft() || this.hasAfterSalesDraft(),
      this.store.actionBusy() || this.store.afterSalesBusy(),
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (
      this.hasShippingDraft() ||
      this.hasAfterSalesDraft() ||
      this.store.actionBusy() ||
      this.store.afterSalesBusy()
    ) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  shipmentLineLabel(order: OrderDto, orderItemId: string): string {
    return order.items.find((item) => item.id === orderItemId)?.name ?? 'Sản phẩm trong đơn';
  }

  private resetDispatchDraft(): void {
    this.dispatchDialog.set(false);
    this.dispatchCarrier.set('');
    this.dispatchTrackingNumber.set('');
    this.dispatchQuantities.set({});
    this.pendingDispatch.set(null);
    this.dispatchNotice.set('');
  }

  private resetShippingDraft(): void {
    this.resetDispatchDraft();
    this.deliveryTarget.set(null);
    this.pendingDeliveries.set({});
    this.refundFormOpen.set(false);
    this.refundReference.set('');
    this.refundAmount.set(null);
    this.refundReason.set('');
    this.refundAt.set('');
    this.refundDirty.set(false);
    this.pendingRefund.set(null);
    this.returnFormOpen.set(false);
    this.returnReference.set('');
    this.returnReason.set('');
    this.returnQuantities.set({});
    this.restockQuantities.set({});
    this.closeRemainingCod.set(false);
    this.returnDirty.set(false);
    this.pendingReturn.set(null);
  }

  private reconcileDispatchDraft(): void {
    const available = new Set(this.store.dispatchableLines().map(({ orderItem }) => orderItem.id));
    const entries = Object.entries(this.dispatchQuantities());
    const removed = entries.filter(([id]) => !available.has(id));
    if (removed.length === 0) return;
    if (removed.some(([, quantity]) => quantity > 0))
      this.dispatchNotice.set(
        'Một số dòng đã được giao đủ ở nơi khác và được bỏ khỏi lựa chọn. Hãy kiểm tra số lượng còn lại trước khi gửi.',
      );
    this.dispatchQuantities.set(Object.fromEntries(entries.filter(([id]) => available.has(id))));
  }

  private clearPendingDelivery(id: string, request: DeliverShipmentRequest): void {
    if (this.pendingDeliveries()[id] !== request) return;
    this.pendingDeliveries.update((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)),
    );
  }

  private hasShippingDraft(): boolean {
    return (
      !!this.pendingDispatch() ||
      Object.keys(this.pendingDeliveries()).length > 0 ||
      !!this.dispatchCarrier().trim() ||
      !!this.dispatchTrackingNumber().trim() ||
      Object.values(this.dispatchQuantities()).some((quantity) => quantity > 0)
    );
  }

  private hasAfterSalesDraft(): boolean {
    return (
      this.refundDirty() ||
      this.returnDirty() ||
      this.pendingRefund() !== null ||
      this.pendingReturn() !== null
    );
  }

  private toLocalDateTime(value: string): string {
    const date = new Date(value);
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
