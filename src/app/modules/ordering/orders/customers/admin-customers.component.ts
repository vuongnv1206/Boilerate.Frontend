import { Component, DestroyRef, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BaseComponent } from '@core/base/base.component';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { AdminCustomerPage, AdminCustomerSummaryDto } from '@api/ordering/models/order.dto';
import { OrdersService } from '@api/ordering/services/orders.service';

@Component({
  selector: 'app-admin-customers',
  host: { class: 'collection-screen' },
  imports: [SHARED_IMPORTS],
  templateUrl: './admin-customers.component.html',
})
export class AdminCustomers extends BaseComponent implements OnInit {
  private loadSub: Subscription | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly search = signal('');
  readonly page = signal<AdminCustomerPage>({ items: [], total: 0, pageNumber: 1, pageSize: 20 });
  override readonly loading = signal(false);
  override readonly errorMessage = signal('');

  constructor(
    private readonly ordersService: OrdersService,
    private readonly router: Router,
    destroyRef: DestroyRef,
  ) {
    super();
    destroyRef.onDestroy(() => {
      this.loadSub?.unsubscribe();
      if (this.searchTimer) clearTimeout(this.searchTimer);
    });
  }

  ngOnInit(): void {
    this.load(1);
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(1), 250);
  }

  load(page = this.page().pageNumber): void {
    this.loadSub?.unsubscribe();
    this.loading.set(true);
    this.errorMessage.set('');
    this.loadSub = this.ordersService
      .getCustomers(this.search(), page, this.page().pageSize)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.page.set(result);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.errorMessage.set(normalizeApiError(err).message);
          this.loading.set(false);
        },
      });
  }

  viewCustomerOrders(customer: AdminCustomerSummaryDto): void {
    void this.router.navigate(['/admin/orders'], { queryParams: { q: customer.email } });
  }
}
