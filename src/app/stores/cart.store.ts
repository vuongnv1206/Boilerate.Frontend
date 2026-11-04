import { Injectable, computed, inject, signal } from '@angular/core';
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
import { normalizeApiError } from '@core/http/normalize-api-error';
import { CartDto, CartLineInput, GuestCartItem, SaveCartRequest } from '@models/cart.dto';
import { ProductFulfillmentKind } from '@models/order.dto';
import { CartService } from '@services/cart.service';

const EMPTY_CART: CartDto = {
  id: '',
  version: null,
  items: [],
  subtotal: 0,
  discountCode: null,
  discountAmount: 0,
  discountError: null,
  shippingAmount: 0,
  total: 0,
  canCheckout: false,
  hasDigitalItems: false,
};

@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly cartService = inject(CartService);
  private readonly session = inject(AuthSession);

  private readonly cartState = signal<CartDto>(EMPTY_CART);
  private readonly loadingState = signal(false);
  private readonly savingState = signal(false);
  private readonly saveErrorState = signal('');
  private readonly uncertainState = signal(false);
  private readSubscription?: Subscription;
  private readonly errorState = signal('');
  private readonly quoteReviewState = signal(false);
  private readonly discountBusyState = signal(false);
  private readonly discountErrorState = signal('');
  private readonly discountUncertainState = signal(false);

  readonly cart = this.cartState.asReadonly();
  readonly loading = computed(() => this.loadingState() || this.savingState());
  readonly reading = this.loadingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly saveError = this.saveErrorState.asReadonly();
  readonly uncertain = this.uncertainState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly quoteNeedsReview = this.quoteReviewState.asReadonly();
  readonly discountBusy = this.discountBusyState.asReadonly();
  readonly discountError = this.discountErrorState.asReadonly();
  readonly discountUncertain = this.discountUncertainState.asReadonly();
  readonly isAuthenticated = computed(() => this.session.signedIn());
  readonly guestItems = computed(() =>
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
  readonly totalAmount = computed(() => this.cartState().total);
  readonly subtotalAmount = computed(() => this.cartState().subtotal);
  readonly discountAmount = computed(() => this.cartState().discountAmount ?? 0);
  readonly shippingAmount = computed(() => this.cartState().shippingAmount);
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
      !this.discountBusyState() &&
      !this.discountUncertainState(),
  );

  loadCart() {
    if (this.savingState() || this.discountBusyState()) return;
    this.readSubscription?.unsubscribe();
    this.loadingState.set(true);
    this.errorState.set('');
    const request = this.session.signedIn()
      ? this.cartService.getCart()
      : this.cartService.getGuestCart();
    this.readSubscription = request
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

  addToCart(item: GuestCartItem): Observable<CartDto> {
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

  updateQuantity(variantId: string, quantity: number) {
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

  removeItem(variantId: string) {
    this.saveLines(
      this.cartState()
        .items.filter((item) => item.variantId !== variantId)
        .map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
    ).subscribe({ error: () => undefined });
  }

  syncGuestCartOnLogin() {
    this.loadCart();
  }

  clearCart() {
    this.cartState.set(EMPTY_CART);
    this.quoteReviewState.set(false);
    this.discountErrorState.set('');
    this.discountUncertainState.set(false);
  }

  setDiscount(code: string | null) {
    if (
      this.loading() ||
      this.uncertainState() ||
      this.discountBusyState() ||
      this.discountUncertainState()
    )
      return;
    this.discountBusyState.set(true);
    this.discountErrorState.set('');
    this.cartService
      .setDiscount({ version: this.cartState().version, code }, !this.session.signedIn())
      .pipe(
        tap((cart) => {
          this.cartState.set(cart);
          this.discountBusyState.set(false);
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
          this.discountBusyState.set(false);
          if (normalized.kind === 'conflict') this.refreshAfterConflict();
          return of(this.cartState());
        }),
      )
      .subscribe();
  }

  acknowledgeUpdatedQuote() {
    this.quoteReviewState.set(false);
    this.errorState.set('');
  }

  refreshAfterConflict() {
    this.quoteReviewState.set(true);
    this.loadCart();
  }

  private saveLines(items: readonly CartLineInput[]): Observable<CartDto> {
    return defer(() => {
      if (
        this.loading() ||
        this.discountBusyState() ||
        this.discountUncertainState() ||
        this.uncertainState()
      )
        return EMPTY;
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
      this.savingState.set(true);
      this.saveErrorState.set('');
      const save = this.session.signedIn()
        ? this.cartService.saveCart(request)
        : this.cartService.saveGuestCart(request);
      return save.pipe(
        tap((cart) => this.cartState.set(cart)),
        catchError((err: unknown) => {
          const error = normalizeApiError(err);
          this.saveErrorState.set(error.message);
          this.savingState.set(false);
          if (error.kind === 'network' || error.kind === 'server') {
            this.uncertainState.set(true);
            this.saveErrorState.set(
              'Chưa xác nhận được thay đổi. Hãy tải lại giỏ hàng trước khi tiếp tục.',
            );
          }
          if (error.kind === 'conflict') this.refreshAfterConflict();
          return throwError(() => err);
        }),
        finalize(() => this.savingState.set(false)),
      );
    });
  }
}
