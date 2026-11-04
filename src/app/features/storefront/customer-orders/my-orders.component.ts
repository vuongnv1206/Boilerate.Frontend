import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthSession } from '@core/auth/auth-session';
import { OrderFulfillmentStatus } from '@models/order.dto';
import { ORDER_STATUS_LABELS } from '@constants/order.constants';
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly page = signal(1);
  readonly email = signal('');
  readonly code = signal('');

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.customerOrderStore.stopListReads());
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const page = Number(params.get('page') ?? 1);
      this.page.set(Number.isSafeInteger(page) && page > 0 ? page : 1);
      this.onRetry();
    });
  }

  onPageChange(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 1 ? page : null },
    });
  }

  onRetry(): void {
    if (!this.session.signedIn() && !this.customerOrderStore.verifiedEmail())
      this.customerOrderStore.restoreGuestAccess(this.page());
    else this.customerOrderStore.loadMyOrders(this.page());
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
        this.customerOrderStore.loadMyOrders(this.page());
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
