import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { StatusBadge } from '@shared/ui/status-badge/status-badge.component';
import { AuthSession } from '@core/auth/auth-session';
import { OrderDetailStore } from '@stores/order-detail.store';
import {
  ConfirmPaymentRequest,
  OrderFulfillmentStatus,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
} from '@models/order.dto';
import {
  ORDER_FULFILLMENT_STATUS_LABELS,
  ORDER_PAYMENT_METHOD_LABELS,
  ORDER_PAYMENT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
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
  ],
  providers: [OrderDetailStore],
  templateUrl: './order-detail.component.html',
  styleUrl: '../../../styles/admin/_orders.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(AuthSession);
  readonly store = inject(OrderDetailStore);
  readonly cancelDialog = signal(false);
  readonly paymentDialog = signal(false);
  readonly paymentSubmitted = signal(false);
  readonly paymentReference = signal('');
  readonly paymentAmount = signal(0);
  readonly paymentCurrency = signal('VND');
  readonly paymentReceivedAt = signal('');
  readonly paymentSource = signal<'ManualBankTransfer' | 'ManualCOD'>('ManualBankTransfer');
  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly paymentStatusLabels = ORDER_PAYMENT_STATUS_LABELS;
  readonly fulfillmentStatusLabels = ORDER_FULFILLMENT_STATUS_LABELS;
  readonly paymentMethodLabels = ORDER_PAYMENT_METHOD_LABELS;
  readonly status = OrderStatus;
  readonly paymentStatus = OrderPaymentStatus;
  readonly fulfillmentStatus = OrderFulfillmentStatus;

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

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) this.store.load(id);
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

  private toLocalDateTime(value: string): string {
    const date = new Date(value);
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
