import { Component, effect, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { BaseComponent } from '@core/base';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { ShipmentDto, ShipmentStatus } from '@api/shipping/models/shipment.dto';
import { ShipmentsService } from '@api/shipping/services/shipments.service';

@Component({
  selector: 'app-customer-shipments-panel',
  host: { style: 'display: contents' },
  imports: [SHARED_IMPORTS],
  templateUrl: './customer-shipments-panel.component.html',
})
export class CustomerShipmentsPanel extends BaseComponent {
  // System variables
  private activeSub: Subscription | null = null;
  readonly orderId = input.required<string>();

  // Business variables
  readonly shipments = signal<readonly ShipmentDto[]>([]);
  readonly shipmentStatus = ShipmentStatus;

  constructor(private readonly shipmentsService: ShipmentsService) {
    super();
    this.destroyRef.onDestroy(() => this.activeSub?.unsubscribe());
    effect(() => {
      const id = this.orderId();
      untracked(() => {
        if (!id) {
          this.resetState();
          return;
        }
        this.loadShipments(id);
      });
    });
  }

  reload(): void {
    const id = this.orderId();
    if (id) {
      this.loadShipments(id);
    }
  }

  private resetState(): void {
    this.activeSub?.unsubscribe();
    this.shipments.set([]);
    this.loading.set(false);
    this.errorMessage.set('');
  }

  private loadShipments(orderId: string): void {
    this.activeSub?.unsubscribe();
    this.loading.set(true);
    this.errorMessage.set('');
    this.activeSub = this.shipmentsService
      .getCustomerShipments(orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.shipments.set(items);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(normalizeApiError(err).message);
        },
      });
  }
}
