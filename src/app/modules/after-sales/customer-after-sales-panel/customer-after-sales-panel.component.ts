import { Component, computed, effect, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { BaseComponent } from '@core/base';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  AfterSalesOrderItemSnapshot,
  AfterSalesSummaryDto,
  ReturnLineInput,
} from '@api/after-sales/models/after-sales.dto';
import { AfterSalesService } from '@api/after-sales/services/after-sales.service';

@Component({
  selector: 'app-customer-after-sales-panel',
  host: { style: 'display: contents' },
  imports: [SHARED_IMPORTS],
  templateUrl: './customer-after-sales-panel.component.html',
})
export class CustomerAfterSalesPanel extends BaseComponent {
  // System variables
  private loadSub: Subscription | null = null;
  readonly orderId = input.required<string>();
  readonly orderItems = input<readonly AfterSalesOrderItemSnapshot[]>([]);

  // Business variables
  readonly summary = signal<AfterSalesSummaryDto | null>(null);
  readonly hasActivity = computed(() => {
    const current = this.summary();
    return Boolean(current && (current.refunds.length > 0 || current.returns.length > 0));
  });

  constructor(private readonly afterSalesService: AfterSalesService) {
    super();
    this.destroyRef.onDestroy(() => this.loadSub?.unsubscribe());
    effect(() => {
      const id = this.orderId();
      untracked(() => {
        if (!id) {
          this.resetState();
          return;
        }
        this.loadSummary(id);
      });
    });
  }

  reload(): void {
    const id = this.orderId();
    if (id) {
      this.loadSummary(id);
    }
  }

  returnQuantity(items: readonly ReturnLineInput[]): number {
    return items.reduce((total, item) => total + item.quantity, 0);
  }

  itemName(orderItemId: string): string {
    return this.orderItems().find((item) => item.id === orderItemId)?.name ?? 'Sản phẩm trong đơn';
  }

  private resetState(): void {
    this.loadSub?.unsubscribe();
    this.summary.set(null);
    this.loading.set(false);
    this.errorMessage.set('');
  }

  private loadSummary(orderId: string): void {
    this.loadSub?.unsubscribe();
    this.loading.set(true);
    this.errorMessage.set('');
    this.loadSub = this.afterSalesService
      .getCustomerAfterSales(orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.summary.set(data);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(normalizeApiError(err).message);
        },
      });
  }
}
