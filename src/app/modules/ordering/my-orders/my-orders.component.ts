import { Component, DestroyRef, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { GuestAccessSession } from '@core/auth/guest-access-session';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  EMPTY_ADMIN_ORDER_PAGE,
  ORDER_STATUS_LABELS,
  OrderFulfillmentStatus,
  OrderPage,
} from '@api/ordering/models/order.dto';
import { OrdersService } from '@api/ordering/services/orders.service';

@Component({
  selector: 'app-my-orders',
  imports: [SHARED_IMPORTS],
  templateUrl: './my-orders.component.html',
})
export class MyOrdersComponent implements OnInit {
  // System variables
  private listSub?: Subscription;

  // Business variables
  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly page = signal(1);
  readonly email = signal('');
  readonly code = signal('');
  readonly myOrders = signal<OrderPage>(EMPTY_ADMIN_ORDER_PAGE);
  readonly loading = signal(false);
  readonly error = signal('');

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
    private readonly ordersService: OrdersService,
    readonly session: AuthSession,
    readonly guestAccess: GuestAccessSession,
  ) {
    this.destroyRef.onDestroy(() => this.listSub?.unsubscribe());
  }

  ngOnInit(): void {
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
    if (!this.session.signedIn() && !this.guestAccess.verifiedEmail()) {
      this.guestAccess.restore(() => this.loadMyOrders(this.page()));
    } else {
      this.loadMyOrders(this.page());
    }
  }

  loadMyOrders(page = 1): void {
    this.listSub?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.listSub = this.ordersService
      .getMyOrders(page, 20)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.myOrders.set(data);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(normalizeApiError(err).message);
          this.myOrders.set(EMPTY_ADMIN_ORDER_PAGE);
          this.loading.set(false);
        },
      });
  }

  onEmailChange(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
    this.code.set('');
    this.guestAccess.reset();
  }

  onCodeChange(event: Event): void {
    this.code.set((event.target as HTMLInputElement).value);
  }

  requestCode(): void {
    this.guestAccess.requestCode(this.email().trim()).subscribe({ error: () => undefined });
  }

  verifyCode(): void {
    this.guestAccess.verifyCode(this.email().trim(), this.code().trim()).subscribe({
      next: () => this.loadMyOrders(this.page()),
      error: () => undefined,
    });
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
