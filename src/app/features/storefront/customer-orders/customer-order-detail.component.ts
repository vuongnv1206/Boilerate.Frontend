import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Icon } from '@shared/ui/icon/icon.component';
import {
  OrderDto,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderStatus,
} from '@models/order.dto';
import { CustomerOrderStore } from '@stores/customer-order.store';

@Component({
  selector: 'app-customer-order-detail',
  standalone: true,
  imports: [ButtonDirective, Dialog, RouterLink, DatePipe, DecimalPipe, Icon],
  templateUrl: './customer-order-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerOrderDetailComponent implements OnInit {
  readonly customerOrderStore = inject(CustomerOrderStore);
  readonly cancelConfirmation = signal(false);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  ngOnInit() {
    this.destroyRef.onDestroy(() => this.customerOrderStore.stopOrderReads());
    this.customerOrderStore.loadPaymentSettings();
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.cancelConfirmation.set(false);
        this.customerOrderStore.loadOrder(id);
      }
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
    if (this.canCancelOrder(order) && !this.customerOrderStore.submitting())
      this.cancelConfirmation.set(true);
  }

  confirmCancel(): void {
    const order = this.customerOrderStore.currentOrder();
    this.cancelConfirmation.set(false);
    if (order && this.canCancelOrder(order))
      this.customerOrderStore.cancelOrder(order.id, order.version);
  }

  getOrderStatusLabel(status: OrderStatus): string {
    return (
      {
        [OrderStatus.PendingPayment]: 'Chờ thanh toán',
        [OrderStatus.AwaitingProcessing]: 'Chờ xử lý',
        [OrderStatus.Cancelled]: 'Đã hủy',
        [OrderStatus.Expired]: 'Đã hết hạn',
        [OrderStatus.Completed]: 'Hoàn tất',
        [OrderStatus.Closed]: 'Đã đóng',
      }[status] ?? 'Đang xử lý'
    );
  }

  getFulfillmentStatusLabel(status: OrderFulfillmentStatus): string {
    switch (status) {
      case OrderFulfillmentStatus.Pending:
        return 'Chờ giao hàng';
      case OrderFulfillmentStatus.InProgress:
        return 'Đang vận chuyển';
      case OrderFulfillmentStatus.Completed:
        return 'Đã hoàn tất';
      case OrderFulfillmentStatus.NeedsReview:
        return 'Cần kiểm tra';
      case OrderFulfillmentStatus.Stopped:
        return 'Đã dừng';
      default:
        return 'Chờ xử lý';
    }
  }
}
