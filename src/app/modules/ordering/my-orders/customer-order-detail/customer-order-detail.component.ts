import { Component, DestroyRef, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { CustomerAfterSalesPanel } from '@modules/after-sales/customer-after-sales-panel/customer-after-sales-panel.component';
import { CustomerDigitalDeliveriesPanel } from '@modules/payments/customer-digital-deliveries-panel/customer-digital-deliveries-panel.component';
import { CustomerRenewalTargetPanel } from '@modules/renewals/customer-renewal-target-panel/customer-renewal-target-panel.component';
import { CustomerShipmentsPanel } from '@modules/shipping/customer-shipments-panel/customer-shipments-panel.component';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  GuestPaymentSettings,
  OrderDto,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderStatus,
  customerOrderDetailFulfillmentLabel,
  customerOrderStatusLabel,
} from '@api/ordering/models/order.dto';
import { OrdersService } from '@api/ordering/services/orders.service';

@Component({
  selector: 'app-customer-order-detail',
  imports: [
    SHARED_IMPORTS,
    CustomerDigitalDeliveriesPanel,
    CustomerShipmentsPanel,
    CustomerRenewalTargetPanel,
    CustomerAfterSalesPanel,
  ],
  templateUrl: './customer-order-detail.component.html',
})
export class CustomerOrderDetailComponent implements OnInit {
  // System variables
  private orderSub?: Subscription;
  private settingsSub?: Subscription;

  // Business variables
  readonly currentOrder = signal<OrderDto | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');
  readonly commandError = signal('');
  readonly submitting = signal(false);
  readonly paymentSettings = signal<GuestPaymentSettings | null>(null);
  readonly settingsLoading = signal(false);
  readonly settingsError = signal('');
  readonly cancelConfirmation = signal(false);

  constructor(
    private readonly destroyRef: DestroyRef,
    private readonly route: ActivatedRoute,
    private readonly ordersService: OrdersService,
    readonly session: AuthSession,
  ) {
    this.destroyRef.onDestroy(() => {
      this.orderSub?.unsubscribe();
      this.settingsSub?.unsubscribe();
    });
  }

  ngOnInit(): void {
    this.loadPaymentSettings();
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.cancelConfirmation.set(false);
        this.loadOrder(id);
      }
    });
  }

  loadOrder(id: string): void {
    this.orderSub?.unsubscribe();
    this.detailLoading.set(true);
    this.detailError.set('');
    this.commandError.set('');
    this.orderSub = this.ordersService
      .getCustomerOrder(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.currentOrder.set(order);
          this.detailLoading.set(false);
        },
        error: (err: unknown) => {
          this.detailError.set(normalizeApiError(err).message);
          this.currentOrder.set(null);
          this.detailLoading.set(false);
        },
      });
  }

  loadPaymentSettings(): void {
    this.settingsSub?.unsubscribe();
    this.settingsLoading.set(true);
    this.settingsError.set('');
    this.settingsSub = this.ordersService
      .getPaymentSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (settings) => {
          this.paymentSettings.set(settings);
          this.settingsLoading.set(false);
        },
        error: (err: unknown) => {
          this.settingsError.set(normalizeApiError(err).message);
          this.paymentSettings.set(null);
          this.settingsLoading.set(false);
        },
      });
  }

  canCancelOrder(order: OrderDto): boolean {
    return (
      order.paymentStatus === OrderPaymentStatus.Unpaid &&
      (order.status === OrderStatus.PendingPayment ||
        order.status === OrderStatus.AwaitingProcessing) &&
      !order.physicalDispatchStarted
    );
  }

  canShowTransfer(order: OrderDto): boolean {
    return (
      order.paymentMethod === 1 &&
      order.paymentStatus === OrderPaymentStatus.Unpaid &&
      (order.status === OrderStatus.PendingPayment ||
        order.status === OrderStatus.AwaitingProcessing)
    );
  }

  isInactiveUnpaid(order: OrderDto): boolean {
    return (
      order.paymentStatus === OrderPaymentStatus.Unpaid &&
      (order.status === OrderStatus.Cancelled || order.status === OrderStatus.Expired)
    );
  }

  onCancelOrder(order: OrderDto): void {
    if (this.canCancelOrder(order) && !this.submitting()) {
      this.cancelConfirmation.set(true);
    }
  }

  confirmCancel(): void {
    const order = this.currentOrder();
    this.cancelConfirmation.set(false);
    if (!order || !this.canCancelOrder(order) || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.commandError.set('');
    this.ordersService
      .cancelCustomerOrder(order.id, order.version)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.currentOrder.set(updated);
          this.submitting.set(false);
        },
        error: (err: unknown) => {
          this.commandError.set(normalizeApiError(err).message);
          this.submitting.set(false);
        },
      });
  }

  getOrderStatusLabel(status: OrderStatus): string {
    return customerOrderStatusLabel(status);
  }

  getFulfillmentStatusLabel(status: OrderFulfillmentStatus): string {
    return customerOrderDetailFulfillmentLabel(status);
  }
}
