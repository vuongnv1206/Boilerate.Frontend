import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
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
  imports: [RouterLink, DatePipe, DecimalPipe, Icon],
  templateUrl: './customer-order-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerOrderDetailComponent implements OnInit {
  readonly customerOrderStore = inject(CustomerOrderStore);
  private readonly route = inject(ActivatedRoute);

  ngOnInit() {
    this.customerOrderStore.loadPaymentSettings();
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.customerOrderStore.loadOrder(id);
      }
    });
  }

  canCancelOrder(order: OrderDto): boolean {
    return (
      order.paymentStatus === OrderPaymentStatus.Unpaid &&
      order.status !== OrderStatus.Cancelled &&
      order.status !== OrderStatus.Expired &&
      order.status !== OrderStatus.Completed
    );
  }

  onCancelOrder(order: OrderDto) {
    if (confirm('Bạn có chắc chắn muốn hủy đơn hàng này không?')) {
      this.customerOrderStore.cancelOrder(order.id, order.version);
    }
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
