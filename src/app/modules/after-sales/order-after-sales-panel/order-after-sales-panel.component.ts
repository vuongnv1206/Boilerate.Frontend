import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subscription, catchError, filter, finalize, tap } from 'rxjs';
import { BaseComponent } from '@core/base/base.component';
import { ApiError } from '@core/http/api-error';
import { createOperationId } from '@core/http/operation-id';
import { ShipmentDto } from '@api/shipping/models/shipment.dto';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  AFTER_SALES_FULFILLMENT_KIND,
  AFTER_SALES_PAYMENT_METHOD,
  AFTER_SALES_PAYMENT_STATUS,
  AfterSalesFailureKind,
  AfterSalesMutationEvent,
  AfterSalesOrderSnapshot,
  AfterSalesSummaryDto,
  ORDER_REFUND_SOURCE_OPTIONS,
  RecordRefundRequest,
  RecordReturnRequest,
  RefundResult,
  RefundSource,
  ReturnLineInput,
  ReturnResult,
  ReturnableLine,
} from '@api/after-sales/models/after-sales.dto';
import { AfterSalesService } from '@api/after-sales/services/after-sales.service';

@Component({
  selector: 'app-order-after-sales-panel',
  host: { style: 'display: block; min-width: 0' },
  imports: [SHARED_IMPORTS],
  templateUrl: './order-after-sales-panel.component.html',
})
export class OrderAfterSalesPanel extends BaseComponent {
  // System variables
  private loadSub: Subscription | null = null;
  private activeOrderId: string | null = null;
  private activeVersion: string | null = null;

  readonly order = input.required<AfterSalesOrderSnapshot>();
  readonly shipments = input<readonly ShipmentDto[] | null>(null);
  readonly orderMutated = output<AfterSalesMutationEvent>();
  readonly busyChanged = output<boolean>();

  // Business variables
  readonly afterSales = signal<AfterSalesSummaryDto | null>(null);
  readonly afterSalesError = signal('');
  readonly actionError = signal('');
  readonly actionFailure = signal<AfterSalesFailureKind>(null);

  readonly refundFormOpen = signal(false);
  readonly refundReference = signal('');
  readonly refundAmount = signal<number | null>(null);
  readonly refundReason = signal('');
  readonly refundSource = signal<RefundSource>('ManualBankTransfer');
  readonly refundSourceOptions = [...ORDER_REFUND_SOURCE_OPTIONS];
  readonly refundAt = signal('');
  readonly refundDirty = signal(false);
  readonly pendingRefund = signal<RecordRefundRequest | null>(null);

  readonly returnFormOpen = signal(false);
  readonly returnReference = signal('');
  readonly returnReason = signal('');
  readonly returnQuantities = signal<Record<string, number>>({});
  readonly restockQuantities = signal<Record<string, number>>({});
  readonly closeRemainingCod = signal(false);
  readonly returnDirty = signal(false);
  readonly pendingReturn = signal<RecordReturnRequest | null>(null);

  readonly paymentMethodCode = AFTER_SALES_PAYMENT_METHOD;
  readonly paymentStatusCode = AFTER_SALES_PAYMENT_STATUS;

  readonly canViewAfterSales = computed(() => this.can('AfterSales', 'View'));
  readonly canViewShipping = computed(() => this.can('Shipping', 'View'));
  readonly canAdjustInventory = computed(() => this.can('Inventory', 'Adjust'));
  readonly refundDateValue = computed(() => this.parseDateTime(this.refundAt()));
  readonly returnableLines = computed<readonly ReturnableLine[]>(() =>
    this.calculateReturnableLines(),
  );

  constructor(private readonly afterSalesService: AfterSalesService) {
    super();
    this.destroyRef.onDestroy(() => this.loadSub?.unsubscribe());
    effect(() => {
      this.busyChanged.emit(this.working());
    });
    effect(() => {
      const currentOrder = this.order();
      const canView = this.canViewAfterSales();
      untracked(() => {
        if (this.activeOrderId !== currentOrder.id) {
          this.activeOrderId = currentOrder.id;
          this.activeVersion = currentOrder.version;
          this.resetAfterSalesDraft();
          this.loadAfterSalesInternal(currentOrder.id, canView);
          return;
        }
        if (this.activeVersion !== currentOrder.version) {
          this.activeVersion = currentOrder.version;
          this.loadAfterSalesInternal(currentOrder.id, canView);
        }
      });
    });
  }

  canRefund(): boolean {
    return this.canViewAfterSales() && this.can('Refund', 'Confirm');
  }

  canReceiveReturn(): boolean {
    return this.canViewAfterSales() && this.canViewShipping() && this.can('Return', 'Receive');
  }

  reloadAfterSales(): void {
    this.loadAfterSalesInternal(this.order().id, this.canViewAfterSales());
  }

  hasUnsavedDraft(): boolean {
    return (
      this.refundDirty() ||
      this.returnDirty() ||
      this.pendingRefund() !== null ||
      this.pendingReturn() !== null
    );
  }

  isBusy(): boolean {
    return this.working();
  }

  setRefundDateTime(value: Date | null): void {
    if (!value) {
      this.refundAt.set('');
    } else {
      const pad = (part: number) => String(part).padStart(2, '0');
      this.refundAt.set(
        `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`,
      );
    }
    this.markRefundDirty();
  }

  openRefundForm(): void {
    if (!this.canRefund() || this.pendingRefund() || this.pendingReturn()) return;
    this.clearActionError();
    this.refundAt.set(this.formatLocalDateTime(new Date().toISOString()));
    this.refundAmount.set(this.afterSales()?.refundableAmount ?? null);
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
    const currentOrder = this.order();
    const summary = this.afterSales();
    const amount = this.refundAmount();
    const reference = this.refundReference().trim();
    const reason = this.refundReason().trim();
    const refundedAt = this.refundAt();
    return (
      Boolean(summary) &&
      this.canRefund() &&
      Boolean(summary && !summary.closed) &&
      currentOrder.paymentStatus === AFTER_SALES_PAYMENT_STATUS.Paid &&
      currentOrder.currency.toUpperCase() === 'VND' &&
      amount !== null &&
      Number.isInteger(amount) &&
      amount > 0 &&
      Boolean(summary && amount <= summary.refundableAmount) &&
      /^[A-Za-z0-9._-]{1,100}$/.test(reference) &&
      reason.length > 0 &&
      reason.length <= 1000 &&
      Boolean(refundedAt) &&
      Number.isFinite(Date.parse(refundedAt)) &&
      Date.parse(refundedAt) <= Date.now()
    );
  }

  submitRefund(): void {
    const currentOrder = this.order();
    if (this.working()) return;
    const pending = this.pendingRefund();
    if (!pending && !this.refundCanSubmit()) return;
    const request: RecordRefundRequest = pending ?? {
      orderVersion: currentOrder.version,
      operationId: createOperationId(),
      reference: this.refundReference().trim(),
      amount: this.refundAmount() ?? 0,
      currency: 'VND',
      refundedAtUtc: new Date(this.refundAt()).toISOString(),
      reason: this.refundReason().trim(),
      source: this.refundSource(),
    };
    this.pendingRefund.set(request);
    const orderId = currentOrder.id;
    this.mutateAfterSales<RefundResult>(
      this.afterSalesService.recordRefund(orderId, request),
      orderId,
    ).subscribe({
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
          this.actionFailure() === 'rejected' &&
          this.pendingRefund() === request
        ) {
          this.pendingRefund.set(null);
        }
      },
    });
  }

  openReturnForm(): void {
    if (!this.canReceiveReturn() || this.pendingRefund() || this.pendingReturn()) return;
    this.clearActionError();
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
    const currentOrder = this.order();
    const summary = this.afterSales();
    const items = this.buildReturnLines();
    const reference = this.returnReference().trim();
    const reason = this.returnReason().trim();
    return (
      Boolean(summary) &&
      this.canReceiveReturn() &&
      Boolean(summary && !summary.closed) &&
      /^[A-Za-z0-9._-]{1,100}$/.test(reference) &&
      reason.length > 0 &&
      reason.length <= 1000 &&
      items.length > 0 &&
      items.length <= 50 &&
      items.every(
        (item) =>
          item.quantity > 0 && item.restockQuantity >= 0 && item.restockQuantity <= item.quantity,
      ) &&
      (!items.some((item) => item.restockQuantity > 0) || this.canAdjustInventory()) &&
      (!this.closeRemainingCod() ||
        (currentOrder.paymentMethod === AFTER_SALES_PAYMENT_METHOD.CashOnDelivery &&
          currentOrder.paymentStatus === AFTER_SALES_PAYMENT_STATUS.Unpaid &&
          this.returnSelectionCompletesDispatched()))
    );
  }

  submitReturn(): void {
    const currentOrder = this.order();
    if (this.working()) return;
    const pending = this.pendingReturn();
    if (!pending && !this.returnCanSubmit()) return;
    if (
      pending &&
      pending.items.some((item) => item.restockQuantity > 0) &&
      !this.canAdjustInventory()
    ) {
      return;
    }
    const request: RecordReturnRequest = pending ?? {
      orderVersion: currentOrder.version,
      operationId: createOperationId(),
      reference: this.returnReference().trim(),
      reason: this.returnReason().trim(),
      items: this.buildReturnLines(),
      closeRemainingCod: this.closeRemainingCod(),
    };
    this.pendingReturn.set(request);
    const orderId = currentOrder.id;
    this.mutateAfterSales<ReturnResult>(
      this.afterSalesService.recordReturn(orderId, request),
      orderId,
    ).subscribe({
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
          this.actionFailure() === 'rejected' &&
          this.pendingReturn() === request
        ) {
          this.pendingReturn.set(null);
        }
      },
    });
  }

  returnQuantity(receipt: { readonly items: readonly ReturnLineInput[] }): number {
    return receipt.items.reduce((total, item) => total + item.quantity, 0);
  }

  restockQuantity(receipt: { readonly items: readonly ReturnLineInput[] }): number {
    return receipt.items.reduce((total, item) => total + item.restockQuantity, 0);
  }

  private loadAfterSalesInternal(orderId: string, canView: boolean): void {
    this.loadSub?.unsubscribe();
    this.afterSales.set(null);
    this.afterSalesError.set('');
    if (!canView) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.loadSub = this.afterSalesService
      .getAdminAfterSales(orderId)
      .pipe(
        finalize(() => {
          if (this.activeOrderId === orderId) this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (summary) => {
          if (this.activeOrderId !== orderId) return;
          this.afterSales.set(summary);
        },
        error: (error: unknown) => {
          if (this.activeOrderId !== orderId) return;
          this.afterSalesError.set(
            error instanceof ApiError ? error.message : 'Không thể tải after-sales.',
          );
          this.afterSales.set(null);
        },
      });
  }

  private mutateAfterSales<T extends RefundResult | ReturnResult>(
    request$: Observable<T>,
    orderId: string,
  ): Observable<T> {
    this.working.set(true);
    this.clearActionError();
    return request$.pipe(
      filter(() => this.activeOrderId === orderId),
      tap(() => {
        this.orderMutated.emit({ preserveActionState: false });
        this.reloadAfterSales();
      }),
      catchError((error: unknown) => {
        if (this.activeOrderId !== orderId) return EMPTY;
        const status = error instanceof ApiError ? error.status : 0;
        this.actionFailure.set(status > 0 && status < 500 ? 'rejected' : 'uncertain');
        this.actionError.set(
          error instanceof ApiError
            ? error.message
            : 'Chưa nhận được kết quả từ máy chủ. Hãy thử lại cùng yêu cầu.',
        );
        if (status === 409) {
          this.orderMutated.emit({ preserveActionState: true });
          this.reloadAfterSales();
        }
        return EMPTY;
      }),
      finalize(() => this.working.set(false)),
      takeUntilDestroyed(this.destroyRef),
    );
  }

  private calculateReturnableLines(): readonly ReturnableLine[] {
    const currentOrder = this.order();
    const currentShipments = this.shipments();
    const summary = this.afterSales();
    if (!currentShipments || !summary) return [];
    const returned = new Map<string, number>();
    for (const existing of summary.returns) {
      for (const item of existing.items) {
        const key = this.returnLineKey(item.shipmentId, item.orderItemId);
        returned.set(key, (returned.get(key) ?? 0) + item.quantity);
      }
    }
    return currentShipments.flatMap((shipment) =>
      shipment.items.flatMap((line) => {
        const item = currentOrder.items.find((value) => value.id === line.orderItemId);
        const key = this.returnLineKey(shipment.id, line.orderItemId);
        const remaining = line.quantity - (returned.get(key) ?? 0);
        return item &&
          item.fulfillmentKind === AFTER_SALES_FULFILLMENT_KIND.Physical &&
          remaining > 0
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

  private clearActionError(): void {
    this.actionError.set('');
    this.actionFailure.set(null);
  }

  private resetAfterSalesDraft(): void {
    this.clearActionError();
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

  private parseDateTime(value: string): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private formatLocalDateTime(value: string): string {
    const date = new Date(value);
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
