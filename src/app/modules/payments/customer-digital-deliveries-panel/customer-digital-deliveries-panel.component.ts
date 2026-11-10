import { Component, effect, input, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BaseComponent } from '@core/base';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { SecretReveal } from '@shared/ui/secret-reveal/secret-reveal.component';
import { DigitalDeliveryDto } from '@api/payments/models/payment.dto';
import { DigitalDeliveriesService } from '@api/payments/services/digital-deliveries.service';

@Component({
  selector: 'app-customer-digital-deliveries-panel',
  host: { style: 'display: contents' },
  imports: [SHARED_IMPORTS, SecretReveal],
  templateUrl: './customer-digital-deliveries-panel.component.html',
})
export class CustomerDigitalDeliveriesPanel extends BaseComponent {
  // System variables
  private activeSub: Subscription | null = null;
  readonly orderId = input.required<string>();
  readonly paid = input.required<boolean>();

  // Business variables
  readonly deliveries = signal<readonly DigitalDeliveryDto[]>([]);
  readonly hiddenIds = signal<Readonly<Record<string, boolean>>>({});

  constructor(private readonly deliveriesService: DigitalDeliveriesService) {
    super();
    this.destroyRef.onDestroy(() => this.activeSub?.unsubscribe());
    effect(() => {
      const id = this.orderId();
      const isPaid = this.paid();
      untracked(() => {
        if (!id || !isPaid) {
          this.resetState();
          return;
        }
        this.loadDeliveries(id);
      });
    });
  }

  reload(): void {
    const id = this.orderId();
    if (id && this.paid()) {
      this.loadDeliveries(id);
    }
  }

  isHidden(deliveryId: string): boolean {
    return this.hiddenIds()[deliveryId] === true;
  }

  hideDelivery(deliveryId: string): void {
    this.hiddenIds.update((current) => ({ ...current, [deliveryId]: true }));
  }

  revealDelivery(deliveryId: string): void {
    this.hiddenIds.update((current) => ({ ...current, [deliveryId]: false }));
  }

  private resetState(): void {
    this.activeSub?.unsubscribe();
    this.deliveries.set([]);
    this.hiddenIds.set({});
    this.loading.set(false);
    this.errorMessage.set('');
  }

  private loadDeliveries(orderId: string): void {
    this.activeSub?.unsubscribe();
    this.loading.set(true);
    this.errorMessage.set('');
    this.activeSub = this.deliveriesService
      .getCustomerDeliveries(orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.deliveries.set(items);
          this.hiddenIds.set({});
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(normalizeApiError(err).message);
        },
      });
  }
}
