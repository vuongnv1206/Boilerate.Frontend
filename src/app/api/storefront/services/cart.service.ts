import { DestroyRef, Injectable, Provider, computed, signal } from '@angular/core';
import {
  EMPTY,
  Observable,
  Subscription,
  catchError,
  defer,
  finalize,
  of,
  tap,
  throwError,
} from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { ApiService } from '@core/http/api.service';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { IdempotentActionTracker } from '@core/http/operation-id';
import { STOREFRONT_CART_BADGE, StorefrontCartBadge } from '@core/navigation/storefront-cart.token';
import {
  AddCartItemInput,
  CartDto,
  CartLineInput,
  EMPTY_CART,
  GuestCartItem,
  SaveCartRequest,
  SetCartDiscountRequest,
} from '../models/cart.dto';
import { CheckoutRequest, CheckoutWireRequest, OrderDto } from '../models/checkout.dto';
import { ProductFulfillmentKind } from '../models/storefront.dto';

type StorefrontCartBadgeReader = StorefrontCartBadge;

@Injectable({ providedIn: 'root' })
export class CartService implements StorefrontCartBadgeReader {
  private readonly idempotency = new IdempotentActionTracker();

  private readSubscription?: Subscription;
  private lastSignedIn: boolean | null = null;

  private readonly cartState = signal<CartDto>(EMPTY_CART);
  private readonly loadingState = signal(false);
  private readonly mutatingState = signal(false);
  private readonly errorState = signal('');
  private readonly saveErrorState = signal('');
  private readonly uncertainState = signal(false);
  private readonly discountLoadingState = signal(false);
  private readonly discountErrorState = signal('');
  private readonly discountUncertainState = signal(false);
  private readonly quoteNeedsReviewState = signal(false);
  private readonly checkoutSubmittingState = signal(false);
  private readonly checkoutErrorState = signal('');
  private readonly quoteConflictState = signal(false);

  readonly cart = this.cartState.asReadonly();
  readonly reading = this.loadingState.asReadonly();
  readonly mutating = this.mutatingState.asReadonly();
  readonly loading = computed(() => this.loadingState() || this.mutatingState());
  readonly error = this.errorState.asReadonly();
  readonly saveError = this.saveErrorState.asReadonly();
  readonly uncertain = this.uncertainState.asReadonly();
  readonly discountLoading = this.discountLoadingState.asReadonly();
  readonly discountError = this.discountErrorState.asReadonly();
  readonly discountUncertain = this.discountUncertainState.asReadonly();
  readonly quoteNeedsReview = this.quoteNeedsReviewState.asReadonly();
  readonly checkoutSubmitting = this.checkoutSubmittingState.asReadonly();
  readonly checkoutError = this.checkoutErrorState.asReadonly();
  readonly quoteConflict = this.quoteConflictState.asReadonly();

  readonly isAuthenticated = computed(() => this.session.signedIn());
  readonly guestItems = computed<readonly GuestCartItem[]>(() =>
    this.cartState().items.map((item) => ({
      variantId: item.variantId,
      productId: '',
      name: item.name,
      sku: item.sku,
      unitPrice: item.unitPrice ?? 0,
      quantity: item.quantity,
      isDigital: item.fulfillmentKind !== ProductFulfillmentKind.Physical,
    })),
  );
  readonly itemCount = computed(() =>
    this.cartState().items.reduce((sum, item) => sum + item.quantity, 0),
  );
  readonly subtotalAmount = computed(() => this.cartState().subtotal);
  readonly discountAmount = computed(() => this.cartState().discountAmount ?? 0);
  readonly shippingAmount = computed(() => this.cartState().shippingAmount);
  readonly totalAmount = computed(() => this.cartState().total);
  readonly hasDigitalItems = computed(
    () =>
      this.cartState().hasDigitalItems ||
      this.cartState().items.some(
        (item) => item.fulfillmentKind !== ProductFulfillmentKind.Physical,
      ),
  );
  readonly canCheckout = computed(
    () =>
      this.cartState().canCheckout &&
      this.cartState().items.length > 0 &&
      !this.loading() &&
      !this.errorState() &&
      !this.uncertainState() &&
      !this.discountLoadingState() &&
      !this.discountUncertainState(),
  );

  constructor(
    private readonly api: ApiService,
    private readonly session: AuthSession,
    destroyRef: DestroyRef,
  ) {
    destroyRef.onDestroy(() => this.readSubscription?.unsubscribe());
  }

  syncOnEnter(signedIn: boolean): void {
    if (this.lastSignedIn !== null && this.lastSignedIn !== signedIn) {
      this.clearCart();
    }
    this.lastSignedIn = signedIn;
    this.loadCart(signedIn);
  }

  loadCart(signedIn = this.session.signedIn()): void {
    if (this.mutatingState() || this.discountLoadingState()) return;
    this.readSubscription?.unsubscribe();
    this.lastSignedIn = signedIn;
    this.loadingState.set(true);
    this.errorState.set('');

    const resource = signedIn ? 'cart' : 'storefront/cart';
    this.readSubscription = this.api
      .get<CartDto>(resource, undefined, { withCredentials: true })
      .pipe(
        tap((cart) => {
          this.cartState.set(cart);
          this.loadingState.set(false);
          this.discountUncertainState.set(false);
          this.uncertainState.set(false);
          this.saveErrorState.set('');
          this.discountErrorState.set('');
        }),
        catchError((err: unknown) => {
          this.errorState.set(normalizeApiError(err).message);
          this.loadingState.set(false);
          return of(this.cartState());
        }),
      )
      .subscribe();
  }

  addItem(item: AddCartItemInput): Observable<CartDto> {
    return defer(() => {
      const lines = this.cartState().items.map((line) => ({
        variantId: line.variantId,
        quantity: line.quantity,
      }));
      const existingIndex = lines.findIndex((line) => line.variantId === item.variantId);
      const updated =
        existingIndex >= 0
          ? lines.map((line, index) =>
              index === existingIndex ? { ...line, quantity: line.quantity + item.quantity } : line,
            )
          : [...lines, { variantId: item.variantId, quantity: item.quantity }];
      return this.saveLines(updated);
    });
  }

  updateQuantity(variantId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(variantId);
      return;
    }
    this.saveLines(
      this.cartState().items.map((item) => ({
        variantId: item.variantId,
        quantity: item.variantId === variantId ? quantity : item.quantity,
      })),
    ).subscribe({ error: () => undefined });
  }

  removeItem(variantId: string): void {
    this.saveLines(
      this.cartState()
        .items.filter((item) => item.variantId !== variantId)
        .map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
    ).subscribe({ error: () => undefined });
  }

  applyDiscount(code: string): void {
    const trimmed = code.trim();
    if (!trimmed) return;
    this.setDiscountInternal(trimmed);
  }

  removeDiscount(): void {
    this.setDiscountInternal(null);
  }

  acknowledgeQuoteChange(): void {
    this.quoteNeedsReviewState.set(false);
    this.errorState.set('');
    this.checkoutErrorState.set('');
    this.quoteConflictState.set(false);
    this.idempotency.clear('checkout');
  }

  refreshAfterConflict(): void {
    this.quoteNeedsReviewState.set(true);
    this.loadCart();
  }

  clearCart(): void {
    this.cartState.set(EMPTY_CART);
    this.quoteNeedsReviewState.set(false);
    this.discountErrorState.set('');
    this.discountUncertainState.set(false);
    this.checkoutErrorState.set('');
    this.quoteConflictState.set(false);
    this.idempotency.clear('checkout');
  }

  checkout(request: CheckoutRequest): Observable<OrderDto> {
    return defer(() => {
      const payload = {
        cartVersion: request.cartVersion,
        paymentMethod: request.paymentMethod,
        recipientName: request.recipientName,
        email: request.email,
        phone: request.phone,
        shippingAddress: request.shippingAddress,
        expectedTotal: request.expectedTotal,
      };
      const operationId =
        request.operationId && request.operationId.trim().length > 0
          ? request.operationId
          : this.idempotency.resolve('checkout', payload);
      const wireRequest: CheckoutWireRequest = {
        ...payload,
        operationId,
      };

      this.checkoutSubmittingState.set(true);
      this.quoteConflictState.set(false);
      this.checkoutErrorState.set('');

      const resource = this.session.signedIn() ? 'orders/checkout' : 'storefront/checkout';
      return this.api.post<OrderDto>(resource, wireRequest, { withCredentials: true }).pipe(
        tap(() => {
          this.idempotency.clear('checkout');
          this.checkoutSubmittingState.set(false);
          this.clearCart();
        }),
        catchError((err: unknown) => {
          const normalized = normalizeApiError(err);
          const isConflict = normalized.status === 409 || normalized.kind === 'conflict';
          this.quoteConflictState.set(isConflict);
          this.checkoutErrorState.set(normalized.message);
          this.checkoutSubmittingState.set(false);
          if (isConflict) {
            this.idempotency.clear('checkout');
            this.refreshAfterConflict();
          } else if (
            normalized.kind !== 'network' &&
            normalized.kind !== 'server' &&
            normalized.kind !== 'rate-limit'
          ) {
            this.idempotency.clear('checkout');
          }
          return throwError(() => err);
        }),
      );
    });
  }

  private setDiscountInternal(code: string | null): void {
    if (
      this.loading() ||
      this.uncertainState() ||
      this.discountLoadingState() ||
      this.discountUncertainState()
    ) {
      return;
    }
    this.discountLoadingState.set(true);
    this.discountErrorState.set('');

    const payload: SetCartDiscountRequest = {
      version: this.cartState().version,
      code,
    };
    const resource = this.session.signedIn() ? 'cart/discount' : 'storefront/cart/discount';

    this.api
      .put<CartDto>(resource, payload, { withCredentials: true })
      .pipe(
        tap((cart) => {
          this.cartState.set(cart);
          this.discountLoadingState.set(false);
        }),
        catchError((err: unknown) => {
          const normalized = normalizeApiError(err);
          if (normalized.kind === 'network' || normalized.kind === 'server') {
            this.discountUncertainState.set(true);
            this.discountErrorState.set(
              'Chưa xác nhận được thay đổi mã. Hãy tải lại giỏ hàng trước khi tiếp tục.',
            );
          } else {
            this.discountErrorState.set(normalized.message);
          }
          this.discountLoadingState.set(false);
          if (normalized.kind === 'conflict') {
            this.refreshAfterConflict();
          }
          return of(this.cartState());
        }),
      )
      .subscribe();
  }

  private saveLines(items: readonly CartLineInput[]): Observable<CartDto> {
    return defer(() => {
      if (
        this.loading() ||
        this.discountLoadingState() ||
        this.discountUncertainState() ||
        this.uncertainState()
      ) {
        return EMPTY;
      }
      if (
        items.length > 50 ||
        items.some(
          (item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999,
        )
      ) {
        const message = 'Giỏ hàng tối đa 50 phân loại, số lượng mỗi phân loại từ 1 đến 999.';
        this.saveErrorState.set(message);
        return throwError(() => new Error(message));
      }

      this.readSubscription?.unsubscribe();
      const request: SaveCartRequest = { version: this.cartState().version, items };
      this.mutatingState.set(true);
      this.saveErrorState.set('');

      const resource = this.session.signedIn() ? 'cart' : 'storefront/cart';
      return this.api.put<CartDto>(resource, request, { withCredentials: true }).pipe(
        tap((cart) => this.cartState.set(cart)),
        catchError((err: unknown) => {
          const error = normalizeApiError(err);
          this.saveErrorState.set(error.message);
          this.mutatingState.set(false);
          if (error.kind === 'network' || error.kind === 'server') {
            this.uncertainState.set(true);
            this.saveErrorState.set(
              'Chưa xác nhận được thay đổi. Hãy tải lại giỏ hàng trước khi tiếp tục.',
            );
          }
          if (error.kind === 'conflict') {
            this.refreshAfterConflict();
          }
          return throwError(() => err);
        }),
        finalize(() => this.mutatingState.set(false)),
      );
    });
  }
}

export function provideStorefrontCart(): Provider {
  return { provide: STOREFRONT_CART_BADGE, useExisting: CartService };
}
