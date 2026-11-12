import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize } from 'rxjs';
import { BaseComponent } from '@core/base/base.component';
import { ApiError } from '@core/http/api-error';
import { createOperationId } from '@core/http/operation-id';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  DeliverShipmentRequest,
  DispatchShipmentRequest,
  DispatchableLine,
  SHIPMENT_STATUS_LABELS,
  SHIPPING_FULFILLMENT_KIND,
  SHIPPING_FULFILLMENT_STATUS,
  SHIPPING_ORDER_STATUS,
  SHIPPING_PAYMENT_METHOD,
  SHIPPING_PAYMENT_STATUS,
  ShipmentDto,
  ShipmentStatus,
  ShippableOrder,
  ShippingActionFailure,
  ShippingFailureKind,
  ShippingMutationEvent,
} from '@api/shipping/models/shipment.dto';
import { ShipmentsService } from '@api/shipping/services/shipments.service';

@Component({
  selector: 'app-order-shipments-panel',
  host: { style: 'display: block; min-width: 0' },
  imports: [SHARED_IMPORTS],
  templateUrl: './order-shipments-panel.component.html',
})
export class OrderShipmentsPanel extends BaseComponent {
  // System variables
  private loadSub: Subscription | null = null;
  private mutationSub: Subscription | null = null;
  private activeOrderId: string | null = null;
  private activeVersion: string | null = null;

  readonly order = input.required<ShippableOrder>();
  readonly externalBusy = input(false);
  readonly dialogError = input('');
  readonly shipmentsChanged = output<readonly ShipmentDto[] | null>();
  readonly orderMutated = output<ShippingMutationEvent>();
  readonly actionFailed = output<ShippingActionFailure>();
  readonly actionStarted = output<void>();
  readonly busyChanged = output<boolean>();

  // Business variables
  readonly shipments = signal<readonly ShipmentDto[] | null>(null);
  readonly shippingError = signal('');
  readonly shippingFailure = signal<ShippingFailureKind>(null);
  readonly dispatchDialog = signal(false);
  readonly dispatchCarrier = signal('');
  readonly dispatchTrackingNumber = signal('');
  readonly dispatchQuantities = signal<Record<string, number>>({});
  readonly pendingDispatch = signal<DispatchShipmentRequest | null>(null);
  readonly dispatchNotice = signal('');
  readonly deliveryTarget = signal<ShipmentDto | null>(null);
  readonly pendingDeliveries = signal<Record<string, DeliverShipmentRequest>>({});
  readonly shipmentStatus = ShipmentStatus;
  readonly shipmentStatusLabels = SHIPMENT_STATUS_LABELS;

  readonly canViewShipping = computed(() => this.can('Shipping', 'View'));
  readonly busy = computed(() => this.working() || this.externalBusy());
  readonly dispatchableLines = computed<readonly DispatchableLine[]>(() => {
    const currentOrder = this.order();
    const list = this.shipments();
    if (!list) return [];
    const shippedByItem = new Map<string, number>();
    for (const shipment of list) {
      for (const line of shipment.items) {
        shippedByItem.set(
          line.orderItemId,
          (shippedByItem.get(line.orderItemId) ?? 0) + line.quantity,
        );
      }
    }
    return currentOrder.items
      .filter((item) => item.fulfillmentKind === SHIPPING_FULFILLMENT_KIND.Physical)
      .map((item) => ({
        orderItem: item,
        remaining: item.quantity - (shippedByItem.get(item.id) ?? 0),
      }))
      .filter((line) => line.remaining > 0);
  });

  readonly canDispatchNow = computed(() => {
    const currentOrder = this.order();
    return (
      this.can('Shipping', 'Dispatch') &&
      this.can('Shipping', 'View') &&
      this.shipments() !== null &&
      !this.loading() &&
      !this.shippingError() &&
      currentOrder.status !== SHIPPING_ORDER_STATUS.Cancelled &&
      currentOrder.status !== SHIPPING_ORDER_STATUS.Expired &&
      currentOrder.status !== SHIPPING_ORDER_STATUS.Closed &&
      currentOrder.fulfillmentStatus !== SHIPPING_FULFILLMENT_STATUS.NeedsReview &&
      (currentOrder.paymentStatus === SHIPPING_PAYMENT_STATUS.Paid ||
        currentOrder.paymentMethod === SHIPPING_PAYMENT_METHOD.CashOnDelivery) &&
      this.dispatchableLines().length > 0
    );
  });

  constructor(private readonly shipmentsService: ShipmentsService) {
    super();
    this.destroyRef.onDestroy(() => {
      this.loadSub?.unsubscribe();
      this.mutationSub?.unsubscribe();
    });
    effect(() => {
      this.busyChanged.emit(this.working());
    });
    effect(() => {
      const currentOrder = this.order();
      const canView = this.canViewShipping();
      untracked(() => {
        if (this.activeOrderId !== currentOrder.id) {
          this.activeOrderId = currentOrder.id;
          this.activeVersion = currentOrder.version;
          this.resetShippingDraft();
          this.loadShipmentsInternal(currentOrder.id, canView);
          return;
        }
        if (this.activeVersion !== currentOrder.version) {
          this.activeVersion = currentOrder.version;
          this.loadShipmentsInternal(currentOrder.id, canView);
        }
      });
    });
    effect(() => {
      const list = this.shipments();
      const isLoading = this.loading();
      const isBusy = this.busy();
      const pending = this.pendingDispatch();
      if (list !== null && !isLoading && !isBusy && !pending) {
        untracked(() => this.reconcileDispatchDraft());
      }
    });
  }

  canDispatchPermission(): boolean {
    return this.can('Shipping', 'Dispatch') && this.can('Shipping', 'View');
  }

  canDeliverPermission(): boolean {
    return this.can('Shipping', 'Deliver') && this.canViewShipping();
  }

  canDeliverShipment(shipment: ShipmentDto): boolean {
    return this.canDeliverPermission() && shipment.status === ShipmentStatus.Dispatched;
  }

  reloadShipments(): void {
    this.loadShipmentsInternal(this.order().id, this.canViewShipping());
  }

  hasUnsavedDraft(): boolean {
    return (
      this.pendingDispatch() !== null ||
      Object.keys(this.pendingDeliveries()).length > 0 ||
      Boolean(this.dispatchCarrier().trim()) ||
      Boolean(this.dispatchTrackingNumber().trim()) ||
      Object.values(this.dispatchQuantities()).some((quantity) => quantity > 0)
    );
  }

  isBusy(): boolean {
    return this.working();
  }

  shipmentLineLabel(orderItemId: string): string {
    return this.order().items.find((item) => item.id === orderItemId)?.name ?? 'Sản phẩm trong đơn';
  }

  dispatchLocked(): boolean {
    return this.pendingDispatch() !== null || this.busy();
  }

  maxDispatchQuantity(remaining: number): number {
    return Math.min(remaining, 999);
  }

  openDispatch(): void {
    if (!this.canDispatchPermission() || (!this.pendingDispatch() && !this.canDispatchNow())) {
      return;
    }
    if (Object.keys(this.dispatchQuantities()).length === 0) {
      this.dispatchQuantities.set(
        Object.fromEntries(this.dispatchableLines().map(({ orderItem }) => [orderItem.id, 0])),
      );
    }
    this.errorMessage.set('');
    this.actionStarted.emit();
    this.dispatchDialog.set(true);
  }

  setDispatchQuantity(orderItemId: string, value: number | string | null): void {
    if (this.dispatchLocked()) return;
    const quantity = Number(value);
    this.dispatchQuantities.update((current) => ({ ...current, [orderItemId]: quantity }));
  }

  dispatchCanSubmit(): boolean {
    if (this.pendingDispatch()) return this.canDispatchPermission();
    const carrier = this.dispatchCarrier().trim();
    const trackingNumber = this.dispatchTrackingNumber().trim();
    if (
      !this.canDispatchNow() ||
      !carrier ||
      carrier.length > 100 ||
      !trackingNumber ||
      trackingNumber.length > 100
    ) {
      return false;
    }
    const remainingById = new Map(
      this.dispatchableLines().map(({ orderItem, remaining }) => [orderItem.id, remaining]),
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

  submitDispatch(): void {
    const currentOrder = this.order();
    if (this.busy() || !this.dispatchCanSubmit()) return;
    const pending = this.pendingDispatch();
    const items = Object.entries(this.dispatchQuantities())
      .filter(([, quantity]) => quantity > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (!pending && items.length === 0) return;

    const request: DispatchShipmentRequest = pending ?? {
      orderVersion: currentOrder.version,
      operationId: createOperationId(),
      carrier: this.dispatchCarrier().trim(),
      trackingNumber: this.dispatchTrackingNumber().trim(),
      items,
    };
    this.pendingDispatch.set(request);
    const orderId = currentOrder.id;
    this.executeShippingMutation(
      orderId,
      this.shipmentsService.dispatchShipment(orderId, request),
      () => {
        if (this.activeOrderId === orderId && this.pendingDispatch() === request) {
          this.resetDispatchDraft();
        }
      },
      () => {
        if (
          this.activeOrderId === orderId &&
          this.pendingDispatch() === request &&
          this.shippingFailure() === 'rejected'
        ) {
          this.pendingDispatch.set(null);
        }
      },
    );
  }

  openDelivery(shipment: ShipmentDto): void {
    if (!this.canDeliverPermission()) return;
    if (!this.canDeliverShipment(shipment) && !this.pendingDeliveries()[shipment.id]) return;
    this.errorMessage.set('');
    this.actionStarted.emit();
    this.deliveryTarget.set(shipment);
  }

  currentDeliveryTarget(): ShipmentDto | null {
    const target = this.deliveryTarget();
    if (!target) return null;
    return this.shipments()?.find((shipment) => shipment.id === target.id) ?? target;
  }

  currentDeliveryCanSubmit(): boolean {
    const shipment = this.currentDeliveryTarget();
    return (
      this.shipments() !== null &&
      !this.loading() &&
      !this.busy() &&
      shipment !== null &&
      (this.canDeliverShipment(shipment) ||
        (Boolean(this.pendingDeliveries()[shipment.id]) && this.canDeliverPermission()))
    );
  }

  onDeliveryDialogVisibility(visible: boolean): void {
    if (!visible) this.deliveryTarget.set(null);
  }

  submitDelivery(): void {
    const target = this.deliveryTarget();
    const currentOrder = this.order();
    if (!target || !this.currentDeliveryCanSubmit()) return;
    const currentShipment = this.shipments()?.find((shipment) => shipment.id === target.id);
    const pending = this.pendingDeliveries()[target.id];
    if (!currentShipment || (!pending && !this.canDeliverShipment(currentShipment))) return;

    const request: DeliverShipmentRequest = pending ?? {
      orderVersion: currentOrder.version,
      version: currentShipment.version,
      operationId: createOperationId(),
    };
    this.pendingDeliveries.update((current) => ({
      ...current,
      [target.id]: request,
    }));
    const orderId = currentOrder.id;
    this.executeShippingMutation(
      orderId,
      this.shipmentsService.deliverShipment(orderId, currentShipment.id, request),
      () => {
        if (this.activeOrderId !== orderId) return;
        this.clearPendingDelivery(target.id, request);
        if (this.deliveryTarget()?.id === target.id) {
          this.deliveryTarget.set(null);
        }
      },
      () => {
        if (this.activeOrderId === orderId && this.shippingFailure() === 'rejected') {
          this.clearPendingDelivery(target.id, request);
        }
      },
    );
  }

  private loadShipmentsInternal(orderId: string, canView: boolean): void {
    this.loadSub?.unsubscribe();
    this.shipments.set(null);
    this.shippingError.set('');
    this.shipmentsChanged.emit(null);
    if (!canView) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.loadSub = this.shipmentsService
      .getAdminShipments(orderId)
      .pipe(
        finalize(() => {
          if (this.activeOrderId === orderId) this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (items) => {
          if (this.activeOrderId !== orderId) return;
          this.shipments.set(items);
          this.shipmentsChanged.emit(items);
        },
        error: (error: unknown) => {
          if (this.activeOrderId !== orderId) return;
          this.shippingError.set(
            error instanceof ApiError ? error.message : 'Không thể tải shipment.',
          );
          this.shipments.set(null);
          this.shipmentsChanged.emit(null);
        },
      });
  }

  private executeShippingMutation(
    orderId: string,
    request$: ReturnType<ShipmentsService['dispatchShipment']>,
    onSuccess: () => void,
    onFinalize: () => void,
  ): void {
    this.mutationSub?.unsubscribe();
    this.working.set(true);
    this.errorMessage.set('');
    this.shippingFailure.set(null);
    this.actionStarted.emit();

    this.mutationSub = request$
      .pipe(
        finalize(() => {
          this.working.set(false);
          onFinalize();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          if (this.activeOrderId !== orderId) return;
          onSuccess();
          this.orderMutated.emit({ preserveActionState: false });
          this.reloadShipments();
        },
        error: (error: unknown) => {
          if (this.activeOrderId !== orderId) return;
          const failure: ShippingFailureKind =
            error instanceof ApiError && error.status > 0 && error.status < 500
              ? 'rejected'
              : 'uncertain';
          this.shippingFailure.set(failure);
          if (error instanceof ApiError && error.status === 409) {
            const message =
              'Đơn hàng hoặc shipment đã thay đổi ở nơi khác. Dữ liệu đã được tải lại; hãy kiểm tra trước khi gửi lại.';
            this.errorMessage.set(message);
            this.actionFailed.emit({ message, conflict: true });
            this.orderMutated.emit({ preserveActionState: true });
            this.reloadShipments();
          } else {
            const message =
              error instanceof ApiError ? error.message : 'Không thể cập nhật vận chuyển.';
            this.errorMessage.set(message);
            this.actionFailed.emit({ message, conflict: false });
          }
        },
      });
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
    this.shippingFailure.set(null);
    this.errorMessage.set('');
  }

  private reconcileDispatchDraft(): void {
    const available = new Set(this.dispatchableLines().map(({ orderItem }) => orderItem.id));
    const entries = Object.entries(this.dispatchQuantities());
    const removed = entries.filter(([id]) => !available.has(id));
    if (removed.length === 0) return;
    if (removed.some(([, quantity]) => quantity > 0)) {
      this.dispatchNotice.set(
        'Một số dòng đã được giao đủ ở nơi khác và được bỏ khỏi lựa chọn. Hãy kiểm tra số lượng còn lại trước khi gửi.',
      );
    }
    this.dispatchQuantities.set(Object.fromEntries(entries.filter(([id]) => available.has(id))));
  }

  private clearPendingDelivery(id: string, request: DeliverShipmentRequest): void {
    if (this.pendingDeliveries()[id] !== request) return;
    this.pendingDeliveries.update((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)),
    );
  }
}
