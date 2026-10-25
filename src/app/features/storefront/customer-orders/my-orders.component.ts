import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthSession } from '@core/auth/auth-session';
import { OrderFulfillmentStatus } from '@models/order.dto';
import { Icon } from '@shared/ui/icon/icon.component';
import { CustomerOrderStore } from '@stores/customer-order.store';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, Icon],
  templateUrl: './my-orders.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyOrdersComponent implements OnInit {
  readonly customerOrderStore = inject(CustomerOrderStore);
  readonly session = inject(AuthSession);
  readonly email = signal('');
  readonly code = signal('');

  ngOnInit() {
    if (this.session.signedIn()) this.customerOrderStore.loadMyOrders();
    else this.customerOrderStore.restoreGuestAccess();
  }

  onRetry() {
    if (!this.session.signedIn() && !this.customerOrderStore.verifiedEmail())
      this.customerOrderStore.restoreGuestAccess();
    else this.customerOrderStore.loadMyOrders();
  }

  onEmailChange(event: Event) {
    this.email.set((event.target as HTMLInputElement).value);
    this.code.set('');
    this.customerOrderStore.resetGuestAccess();
  }

  requestCode() {
    this.customerOrderStore
      .requestAccessCode(this.email().trim())
      .subscribe({ error: () => undefined });
  }

  verifyCode() {
    this.customerOrderStore.verifyAccessCode(this.email().trim(), this.code().trim()).subscribe(
      () => {
        this.customerOrderStore.loadMyOrders();
      },
      () => undefined,
    );
  }

  getFulfillmentStatusLabel(status: OrderFulfillmentStatus): string {
    switch (status) {
      case OrderFulfillmentStatus.Pending:
        return 'Chờ giao';
      case OrderFulfillmentStatus.InProgress:
        return 'Đang giao hàng';
      case OrderFulfillmentStatus.Completed:
        return 'Giao thành công';
      case OrderFulfillmentStatus.NeedsReview:
        return 'Cần kiểm tra';
      case OrderFulfillmentStatus.Stopped:
        return 'Đã dừng';
      default:
        return 'Chờ xử lý';
    }
  }
}
