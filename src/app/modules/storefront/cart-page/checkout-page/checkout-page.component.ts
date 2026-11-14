import { Component, DestroyRef, OnInit, computed, effect, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subscription, catchError, of, tap } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { GuestAccessSession } from '@core/auth/guest-access-session';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { CheckoutRequest, OrderPaymentMethod } from '@api/storefront/models/checkout.dto';
import { GuestPaymentSettings } from '@api/storefront/models/storefront-settings.dto';
import { ProductFulfillmentKind } from '@api/storefront/models/storefront.dto';
import { CartService } from '@api/storefront/services/cart.service';
import { StorefrontSettingsService } from '@api/storefront/services/storefront-settings.service';
import { DiscountCodeComponent } from '../discount-code/discount-code.component';

@Component({
  selector: 'app-checkout-page',
  imports: [SHARED_IMPORTS, DiscountCodeComponent],
  templateUrl: './checkout-page.component.html',
})
export class CheckoutPageComponent implements OnInit {
  // System variables
  private settingsSubscription?: Subscription;
  private orderPlaced = false;

  // Business variables
  readonly paymentSettings = signal<GuestPaymentSettings | null>(null);
  readonly settingsLoading = signal(false);
  readonly settingsError = signal('');

  readonly recipientName = signal('');
  readonly phone = signal('');
  readonly email = signal('');
  readonly shippingAddress = signal('');
  readonly selectedPaymentMethod = signal<OrderPaymentMethod>(OrderPaymentMethod.Prepaid);
  readonly verificationCode = signal('');
  readonly pendingCheckout = signal<CheckoutRequest | null>(null);

  readonly hasPhysicalItems = computed(() =>
    this.cartService
      .cart()
      .items.some((item) => item.fulfillmentKind === ProductFulfillmentKind.Physical),
  );

  readonly actionError = computed(
    () => this.cartService.checkoutError() || this.guestAccess.error(),
  );

  readonly canSubmit = computed(() => {
    const hasName = this.recipientName().trim().length > 0;
    const hasPhone = this.phone().trim().length > 0;
    const hasEmail = this.email().trim().includes('@');
    const emailVerified =
      this.session.signedIn() ||
      this.guestAccess.verifiedEmail()?.toLowerCase() === this.email().trim().toLowerCase();
    const hasDigitalItems = this.cartService.hasDigitalItems();
    const hasAddress = !this.hasPhysicalItems() || this.shippingAddress().trim().length > 0;
    const validMethod =
      (this.selectedPaymentMethod() === OrderPaymentMethod.Prepaid &&
        this.paymentSettings()?.bankTransferEnabled === true) ||
      (!hasDigitalItems && this.selectedPaymentMethod() === OrderPaymentMethod.CashOnDelivery);

    return (
      hasName &&
      hasPhone &&
      hasEmail &&
      emailVerified &&
      hasAddress &&
      validMethod &&
      this.cartService.canCheckout() &&
      !this.cartService.quoteNeedsReview()
    );
  });

  constructor(
    readonly cartService: CartService,
    readonly guestAccess: GuestAccessSession,
    readonly session: AuthSession,
    private readonly settingsService: StorefrontSettingsService,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
  ) {
    this.destroyRef.onDestroy(() => this.settingsSubscription?.unsubscribe());
    // Nothing to check out: go back to the cart. Not after an order, which also empties the cart.
    effect(() => {
      const empty =
        !this.cartService.loading() &&
        !this.cartService.error() &&
        this.cartService.cart().items.length === 0;
      if (empty && !this.orderPlaced) {
        void this.router.navigate(['/shop/cart'], { replaceUrl: true });
      }
    });
  }

  ngOnInit(): void {
    this.cartService.loadCart();
    this.loadPaymentSettings();
    if (!this.session.signedIn()) {
      this.guestAccess.restore();
    }
  }

  loadPaymentSettings(): void {
    this.settingsSubscription?.unsubscribe();
    this.settingsLoading.set(true);
    this.settingsError.set('');
    this.paymentSettings.set(null);

    this.settingsSubscription = this.settingsService
      .getPublicSettings()
      .pipe(
        tap((settings) => {
          this.paymentSettings.set(settings);
          this.settingsLoading.set(false);
        }),
        catchError((err: unknown) => {
          this.settingsLoading.set(false);
          this.settingsError.set(normalizeApiError(err).message);
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  onRecipientNameInput(event: Event): void {
    this.recipientName.set((event.target as HTMLInputElement).value);
  }

  onPhoneInput(event: Event): void {
    this.phone.set((event.target as HTMLInputElement).value);
  }

  onEmailChange(event: Event): void {
    const nextEmail = (event.target as HTMLInputElement).value;
    if (nextEmail.trim().toLowerCase() !== this.email().trim().toLowerCase()) {
      this.guestAccess.reset();
      this.verificationCode.set('');
    }
    this.email.set(nextEmail);
  }

  onVerificationCodeInput(event: Event): void {
    this.verificationCode.set((event.target as HTMLInputElement).value);
  }

  onShippingAddressInput(event: Event): void {
    this.shippingAddress.set((event.target as HTMLTextAreaElement).value);
  }

  onSelectPaymentMethod(method: OrderPaymentMethod): void {
    this.selectedPaymentMethod.set(method);
  }

  requestEmailCode(): void {
    this.guestAccess
      .requestCode(this.email().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }

  verifyEmailCode(): void {
    this.guestAccess
      .verifyCode(this.email().trim(), this.verificationCode().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }

  acknowledgeQuote(): void {
    this.cartService.acknowledgeQuoteChange();
    this.pendingCheckout.set(null);
  }

  onSubmit(): void {
    if (!this.canSubmit() || this.cartService.checkoutSubmitting()) return;

    const cart = this.cartService.cart();
    const request: CheckoutRequest = this.pendingCheckout() ?? {
      cartVersion: cart.version ?? '',
      paymentMethod: this.selectedPaymentMethod(),
      recipientName: this.recipientName().trim(),
      email: this.email().trim(),
      phone: this.phone().trim(),
      shippingAddress: this.shippingAddress().trim() || null,
      expectedTotal: cart.total,
    };
    this.pendingCheckout.set(request);

    this.cartService
      .checkout(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.orderPlaced = true;
          this.pendingCheckout.set(null);
          void this.router.navigate(['/shop/orders', order.id]);
        },
        error: (rawError: unknown) => {
          const apiError = normalizeApiError(rawError);
          if (
            this.cartService.quoteConflict() ||
            (apiError.kind !== 'network' &&
              apiError.kind !== 'server' &&
              apiError.kind !== 'rate-limit')
          ) {
            this.pendingCheckout.set(null);
          }
        },
      });
  }
}
