import { Component, computed, effect, input, output, signal } from '@angular/core';
import { BaseComponent } from '@core/base/base.component';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  ORDER_PAYMENT_SOURCE_OPTIONS,
  PAYMENT_FULFILLMENT_STATUS_CODE,
  PAYMENT_METHOD_CODE,
  PAYMENT_ORDER_STATUS,
  PAYMENT_STATUS_CODE,
  PaymentActionFailure,
  PaymentPanelOrder,
  PaymentSource,
} from '@api/payments/models/payment.dto';
import { PaymentsService } from '@api/payments/services/payments.service';

@Component({
  selector: 'app-order-payment-panel',
  host: { style: 'display: block' },
  imports: [SHARED_IMPORTS],
  templateUrl: './order-payment-panel.component.html',
})
export class OrderPaymentPanel extends BaseComponent {
  // System variables
  readonly order = input.required<PaymentPanelOrder>();
  readonly externalBusy = input(false);
  readonly orderUpdated = output<unknown>();
  readonly actionFailed = output<PaymentActionFailure>();
  readonly actionStarted = output<void>();
  readonly busyChanged = output<boolean>();

  // Business variables
  readonly paymentDialog = signal(false);
  readonly paymentReference = signal('');
  readonly paymentAmount = signal(0);
  readonly paymentCurrency = signal('VND');
  readonly paymentReceivedAt = signal('');
  readonly paymentSource = signal<PaymentSource>('ManualBankTransfer');
  readonly paymentSourceOptions = [...ORDER_PAYMENT_SOURCE_OPTIONS];
  readonly paymentStatusCode = PAYMENT_STATUS_CODE;

  readonly busy = computed(() => this.working() || this.externalBusy());
  readonly paymentDateValue = computed(() => this.parseDateTime(this.paymentReceivedAt()));
  readonly canRetryFulfillment = computed(() => {
    const current = this.order();
    return (
      current.paymentStatus === PAYMENT_STATUS_CODE.Paid &&
      current.status !== PAYMENT_ORDER_STATUS.Cancelled &&
      current.status !== PAYMENT_ORDER_STATUS.Closed &&
      current.fulfillmentStatus === PAYMENT_FULFILLMENT_STATUS_CODE.NeedsReview &&
      !current.physicalDispatchStarted
    );
  });

  constructor(private readonly paymentsService: PaymentsService) {
    super();
    effect(() => {
      this.busyChanged.emit(this.working());
    });
  }

  canConfirmPayment(): boolean {
    return this.can('Payment', 'Confirm');
  }

  canFulfill(): boolean {
    return this.can('Order', 'Fulfill');
  }

  openPayment(): void {
    const current = this.order();
    this.paymentReference.set('');
    this.paymentAmount.set(current.total);
    this.paymentCurrency.set(current.currency);
    this.paymentReceivedAt.set(
      this.formatLocalDateTime(current.paidAtUtc ?? new Date().toISOString()),
    );
    this.paymentSource.set(
      current.paymentMethod === PAYMENT_METHOD_CODE.CashOnDelivery
        ? 'ManualCOD'
        : 'ManualBankTransfer',
    );
    this.errorMessage.set('');
    this.actionStarted.emit();
    this.paymentDialog.set(true);
  }

  setPaymentDateTime(value: Date | null): void {
    if (!value) {
      this.paymentReceivedAt.set('');
      return;
    }
    const pad = (part: number) => String(part).padStart(2, '0');
    this.paymentReceivedAt.set(
      `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`,
    );
  }

  submitPayment(): void {
    if (!this.canConfirmPayment() || this.busy()) return;
    const current = this.order();
    const reference = this.paymentReference().trim();
    const receivedAt = this.paymentReceivedAt();
    if (!reference || !receivedAt) return;

    const payload = {
      version: current.version,
      reference,
      amount: this.paymentAmount(),
      currency: this.paymentCurrency().trim(),
      receivedAtUtc: new Date(receivedAt).toISOString(),
      source: this.paymentSource(),
    };
    this.actionStarted.emit();
    this.runIdempotent(
      `confirm-payment:${current.id}`,
      payload,
      (operationId) =>
        this.paymentsService.confirmPayment(current.id, {
          ...payload,
          operationId,
        }),
      {
        onSuccess: (updated) => {
          this.paymentDialog.set(false);
          this.orderUpdated.emit(updated);
        },
        onError: (error) => {
          const conflict = error.status === 409;
          const message = conflict
            ? 'Đơn hàng đã thay đổi ở nơi khác. Màn hình đã được tải lại; hãy kiểm tra lại trước khi thao tác tiếp.'
            : error.message;
          this.errorMessage.set(message);
          this.actionFailed.emit({ message, conflict });
        },
      },
    );
  }

  retryFulfillment(): void {
    if (!this.canFulfill() || !this.canRetryFulfillment() || this.busy()) return;
    const current = this.order();
    const payload = { orderId: current.id, version: current.version };
    this.actionStarted.emit();
    this.runIdempotent(
      `retry-fulfillment:${current.id}`,
      payload,
      (operationId) =>
        this.paymentsService.retryFulfillment(current.id, {
          version: current.version,
          operationId,
        }),
      {
        onSuccess: (updated) => {
          this.orderUpdated.emit(updated);
        },
        onError: (error) => {
          const conflict = error.status === 409;
          const message = conflict
            ? 'Đơn hàng đã thay đổi ở nơi khác. Màn hình đã được tải lại; hãy kiểm tra lại trước khi thao tác tiếp.'
            : error.message;
          this.actionFailed.emit({ message, conflict });
        },
      },
    );
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
