import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthSession } from '@core/auth/auth-session';
import { CheckoutRequest } from '@models/checkout.dto';
import { OrderPaymentMethod } from '@models/order.dto';
import { Icon } from '@shared/ui/icon/icon.component';
import { CartStore } from '@stores/cart.store';
import { CustomerOrderStore } from '@stores/customer-order.store';

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [RouterLink, DecimalPipe, Icon],
  templateUrl: './checkout-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPageComponent implements OnInit {
  readonly cartStore = inject(CartStore);
  readonly customerOrderStore = inject(CustomerOrderStore);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);

  readonly recipientName = signal('');
  readonly phone = signal('');
  readonly email = signal('');
  readonly shippingAddress = signal('');
  readonly selectedPaymentMethod = signal<OrderPaymentMethod>(OrderPaymentMethod.Prepaid);
  readonly verificationCode = signal('');
  readonly pendingCheckout = signal<CheckoutRequest | null>(null);

  readonly canSubmit = computed(() => {
    const hasName = this.recipientName().trim().length > 0;
    const hasPhone = this.phone().trim().length > 0;
    const hasEmail = this.email().trim().includes('@');
    const emailVerified =
      this.session.signedIn() ||
      this.customerOrderStore.verifiedEmail()?.toLowerCase() === this.email().trim().toLowerCase();
    const isDigital = this.cartStore.hasDigitalItems();
    const hasAddress = isDigital || this.shippingAddress().trim().length > 0;
    const validMethod =
      (this.selectedPaymentMethod() === OrderPaymentMethod.Prepaid &&
        this.customerOrderStore.paymentSettings()?.bankTransferEnabled === true) ||
      (!isDigital && this.selectedPaymentMethod() === OrderPaymentMethod.CashOnDelivery);

    return (
      hasName &&
      hasPhone &&
      hasEmail &&
      emailVerified &&
      hasAddress &&
      validMethod &&
      this.cartStore.canCheckout() &&
      !this.cartStore.quoteNeedsReview()
    );
  });

  ngOnInit() {
    this.cartStore.loadCart();
    this.customerOrderStore.loadPaymentSettings();
    if (!this.session.signedIn()) this.customerOrderStore.restoreGuestAccess();
  }

  onEmailChange(event: Event) {
    const email = (event.target as HTMLInputElement).value;
    if (email.trim().toLowerCase() !== this.email().trim().toLowerCase()) {
      this.customerOrderStore.resetGuestAccess();
      this.verificationCode.set('');
    }
    this.email.set(email);
  }

  requestEmailCode() {
    this.customerOrderStore
      .requestAccessCode(this.email().trim())
      .subscribe({ error: () => undefined });
  }

  verifyEmailCode() {
    this.customerOrderStore
      .verifyAccessCode(this.email().trim(), this.verificationCode().trim())
      .subscribe({ error: () => undefined });
  }

  acknowledgeQuote() {
    this.cartStore.acknowledgeUpdatedQuote();
    this.pendingCheckout.set(null);
  }

  onSubmit() {
    if (!this.canSubmit() || this.customerOrderStore.submitting()) return;

    const cart = this.cartStore.cart();
    const request: CheckoutRequest = this.pendingCheckout() ?? {
      cartVersion: cart.version ?? '',
      operationId: crypto.randomUUID(),
      paymentMethod: this.selectedPaymentMethod(),
      recipientName: this.recipientName().trim(),
      email: this.email().trim(),
      phone: this.phone().trim(),
      shippingAddress: this.shippingAddress().trim() || null,
      expectedTotal: cart.total,
    };
    this.pendingCheckout.set(request);

    this.customerOrderStore.checkout(request).subscribe({
      next: (order) => {
        this.pendingCheckout.set(null);
        this.cartStore.clearCart();
        void this.router.navigate(['/shop/orders', order.id]);
      },
      error: () => {
        if (this.customerOrderStore.quoteConflict()) {
          this.pendingCheckout.set(null);
          this.cartStore.refreshAfterConflict();
        }
      },
    });
  }
}
