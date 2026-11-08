import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { BaseComponent } from '@core/base';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  RENEWAL_FULFILLMENT_KIND,
  RENEWAL_ORDER_STATUS,
  RENEWAL_PAYMENT_STATUS,
  RENEWAL_STATUS_LABELS,
  RenewalDto,
  RenewalOrderSnapshot,
  renewalStatusTone,
} from '../models/renewal.dto';
import { RenewalsService } from '../services/renewals.service';

@Component({
  selector: 'app-order-renewals-panel',
  host: { style: 'display: block; min-width: 0' },
  imports: [SHARED_IMPORTS],
  templateUrl: './order-renewals-panel.component.html',
})
export class OrderRenewalsPanel extends BaseComponent {
  // System variables
  private activeOrderId: string | null = null;
  readonly order = input.required<RenewalOrderSnapshot>();
  readonly externalBusy = input(false);
  readonly orderMutated = output<void>();

  // Business variables
  readonly provisionedRenewals = signal<readonly RenewalDto[]>([]);
  readonly statusLabels = RENEWAL_STATUS_LABELS;
  readonly statusTone = renewalStatusTone;

  readonly canViewRenewals = computed(() => this.can('Renewal', 'View'));
  readonly canProcessRenewals = computed(() => this.can('Renewal', 'Process'));
  readonly busy = computed(() => this.working() || this.externalBusy());
  readonly hasManualExtensionItems = computed(() =>
    this.order().items.some(
      (item) => item.fulfillmentKind === RENEWAL_FULFILLMENT_KIND.ManualExtension,
    ),
  );
  readonly canProvision = computed(() => {
    const current = this.order();
    return (
      this.hasManualExtensionItems() &&
      this.canProcessRenewals() &&
      current.paymentStatus === RENEWAL_PAYMENT_STATUS.Paid &&
      current.status !== RENEWAL_ORDER_STATUS.Cancelled &&
      current.status !== RENEWAL_ORDER_STATUS.Expired &&
      current.status !== RENEWAL_ORDER_STATUS.Closed
    );
  });

  constructor(private readonly renewalsService: RenewalsService) {
    super();
    effect(() => {
      const current = this.order();
      untracked(() => {
        if (this.activeOrderId !== current.id) {
          this.activeOrderId = current.id;
          this.provisionedRenewals.set([]);
          this.errorMessage.set('');
        }
      });
    });
  }

  provision(): void {
    if (!this.canProvision() || this.busy()) return;
    const current = this.order();
    this.run(
      this.renewalsService.provisionOrderRenewals(current.id, {
        orderVersion: current.version,
      }),
      {
        onSuccess: (items) => {
          this.provisionedRenewals.set(items);
          this.orderMutated.emit();
        },
      },
    );
  }
}
