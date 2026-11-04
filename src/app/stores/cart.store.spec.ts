import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '@core/auth/auth-session';
import { CartDto, SaveCartRequest } from '@models/cart.dto';
import { ProductFulfillmentKind } from '@models/order.dto';
import { CartService } from '@services/cart.service';
import { CartStore } from '@stores/cart.store';

describe('CartStore', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('keeps the guest cart on the server and derives totals from the saved quote', () => {
    const empty: CartDto = {
      id: 'cart-1',
      version: 'v1',
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
    const cartService = {
      getGuestCart: vi.fn(() => of(empty)),
      saveGuestCart: vi.fn((req: SaveCartRequest) =>
        of({
          ...empty,
          version: 'v2',
          items: req.items.map((item) => ({
            ...item,
            name: 'Key Phần mềm',
            sku: 'KEY-01',
            unitPrice: 150000,
            isAvailable: true,
            fulfillmentKind: ProductFulfillmentKind.DigitalUnique,
          })),
          subtotal: 450000,
          total: 450000,
          canCheckout: true,
          hasDigitalItems: true,
        }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: { signedIn: () => false } },
        { provide: CartService, useValue: cartService },
        CartStore,
      ],
    });

    const store = TestBed.inject(CartStore);
    store.loadCart();
    expect(cartService.getGuestCart).toHaveBeenCalled();

    store
      .addToCart({
        variantId: 'var-1',
        productId: 'prod-1',
        name: 'Key Phần mềm',
        sku: 'KEY-01',
        unitPrice: 150000,
        quantity: 2,
        isDigital: true,
      })
      .subscribe();

    expect(store.itemCount()).toBe(2);
    expect(cartService.saveGuestCart).toHaveBeenCalled();
    expect(store.totalAmount()).toBe(450000);
    expect(store.hasDigitalItems()).toBe(true);

    expect(store.itemCount()).toBe(2);
    store.updateQuantity('var-1', 3);
    expect(store.itemCount()).toBe(3);
    expect(cartService.saveGuestCart).toHaveBeenLastCalledWith({
      version: 'v2',
      items: [{ variantId: 'var-1', quantity: 3 }],
    });

    store.removeItem('var-1');
    expect(store.itemCount()).toBe(0);
    expect(cartService.saveGuestCart).toHaveBeenLastCalledWith({ version: 'v2', items: [] });
  });

  it('syncs with server cart when user is authenticated', () => {
    const mockCart: CartDto = {
      id: 'cart-1',
      version: 'v1',
      items: [
        {
          variantId: 'var-2',
          quantity: 1,
          name: 'Áo thun',
          sku: 'AO-01',
          unitPrice: 200000,
          isAvailable: true,
          fulfillmentKind: ProductFulfillmentKind.Physical,
        },
      ],
      subtotal: 200000,
      discountCode: null,
      discountAmount: 0,
      discountError: null,
      shippingAmount: 30000,
      total: 230000,
      canCheckout: true,
      hasDigitalItems: false,
    };

    const cartService = {
      getCart: vi.fn(() => of(mockCart)),
      saveCart: vi.fn((req: SaveCartRequest) =>
        of({
          ...mockCart,
          version: 'v2',
          items: req.items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            name: 'Áo thun',
            sku: 'AO-01',
            unitPrice: 200000,
            isAvailable: true,
            fulfillmentKind: ProductFulfillmentKind.Physical,
          })),
        }),
      ),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: { signedIn: () => true } },
        { provide: CartService, useValue: cartService },
        CartStore,
      ],
    });

    const store = TestBed.inject(CartStore);
    store.loadCart();

    expect(cartService.getCart).toHaveBeenCalled();
    expect(store.itemCount()).toBe(1);
    expect(store.totalAmount()).toBe(230000);
    expect(store.canCheckout()).toBe(true);
  });

  it.each([false, true])(
    'uses server quote for discount and removes it (signed in: %s)',
    (signedIn) => {
      const cart: CartDto = {
        id: 'cart',
        version: 'v1',
        items: [
          {
            variantId: 'v',
            quantity: 1,
            name: 'Sản phẩm',
            sku: 'S',
            unitPrice: 100,
            isAvailable: true,
            fulfillmentKind: ProductFulfillmentKind.Physical,
          },
        ],
        subtotal: 100,
        discountCode: null,
        discountAmount: 0,
        discountError: null,
        shippingAmount: 0,
        total: 100,
        canCheckout: true,
        hasDigitalItems: false,
      };
      const response = new Subject<CartDto>();
      const api = {
        getCart: vi.fn(() => of(cart)),
        getGuestCart: vi.fn(() => of(cart)),
        setDiscount: vi.fn(() => response),
      };
      TestBed.configureTestingModule({
        providers: [
          { provide: AuthSession, useValue: { signedIn: () => signedIn } },
          { provide: CartService, useValue: api },
          CartStore,
        ],
      });
      const store = TestBed.inject(CartStore);
      store.loadCart();
      store.setDiscount('SAVE10');
      expect(api.setDiscount).toHaveBeenCalledWith({ version: 'v1', code: 'SAVE10' }, !signedIn);
      expect(store.canCheckout()).toBe(false);
      response.next({
        ...cart,
        version: 'v2',
        discountCode: 'SAVE10',
        discountAmount: 10,
        total: 90,
      });
      response.complete();
      expect(store.discountAmount()).toBe(10);
      expect(store.totalAmount()).toBe(90);
      expect(store.canCheckout()).toBe(true);
      store.setDiscount(null);
      expect(api.setDiscount).toHaveBeenLastCalledWith({ version: 'v2', code: null }, !signedIn);
    },
  );

  it('blocks checkout on an uncertain discount mutation until the cart is reloaded', () => {
    const cart: CartDto = {
      id: 'cart',
      version: 'v1',
      items: [
        {
          variantId: 'v',
          quantity: 1,
          name: 'Sản phẩm',
          sku: 'S',
          unitPrice: 100,
          isAvailable: true,
          fulfillmentKind: ProductFulfillmentKind.Physical,
        },
      ],
      subtotal: 100,
      discountCode: null,
      discountAmount: 0,
      discountError: null,
      shippingAmount: 0,
      total: 100,
      canCheckout: true,
      hasDigitalItems: false,
    };
    const api = {
      getGuestCart: vi.fn(() => of(cart)),
      setDiscount: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 0 }))),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: { signedIn: () => false } },
        { provide: CartService, useValue: api },
        CartStore,
      ],
    });
    const store = TestBed.inject(CartStore);
    store.loadCart();
    store.setDiscount('SAVE10');
    expect(store.discountUncertain()).toBe(true);
    expect(store.canCheckout()).toBe(false);
    store.setDiscount('SAVE10');
    expect(api.setDiscount).toHaveBeenCalledTimes(1);
    store.loadCart();
    expect(store.discountUncertain()).toBe(false);
    expect(store.canCheckout()).toBe(true);
  });
  it('never emits success on a failed save and blocks competing saves', () => {
    const response = new Subject<CartDto>();
    const cart: CartDto = {
      id: 'c',
      version: 'v1',
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
    const api = { getGuestCart: vi.fn(() => of(cart)), saveGuestCart: vi.fn(() => response) };
    TestBed.configureTestingModule({
      providers: [
        CartStore,
        { provide: AuthSession, useValue: { signedIn: () => false } },
        { provide: CartService, useValue: api },
      ],
    });
    const store = TestBed.inject(CartStore);
    store.loadCart();
    const item = {
      variantId: 'v',
      productId: 'p',
      name: 'Free',
      sku: 'S',
      unitPrice: 0,
      quantity: 1,
      isDigital: false,
    };
    const success = vi.fn();
    store.addToCart(item).subscribe({ next: success, error: () => undefined });
    store.addToCart(item).subscribe();
    expect(api.saveGuestCart).toHaveBeenCalledTimes(1);
    expect(success).not.toHaveBeenCalled();
    response.error(new HttpErrorResponse({ status: 0 }));
    expect(success).not.toHaveBeenCalled();
    expect(store.cart()).toBe(cart);
    expect(store.uncertain()).toBe(true);
    expect(store.canCheckout()).toBe(false);
    store.loadCart();
    expect(store.uncertain()).toBe(false);
  });

  it.each([0, 1000, 1.5, NaN, Infinity])(
    'rejects invalid quantity %s before sending',
    (quantity) => {
      const api = { saveGuestCart: vi.fn() };
      TestBed.configureTestingModule({
        providers: [
          CartStore,
          { provide: AuthSession, useValue: { signedIn: () => false } },
          { provide: CartService, useValue: api },
        ],
      });
      const store = TestBed.inject(CartStore);
      const error = vi.fn();
      store
        .addToCart({
          variantId: 'v',
          productId: 'p',
          name: 'P',
          sku: 'S',
          unitPrice: 0,
          quantity,
          isDigital: false,
        })
        .subscribe({ error });
      expect(error).toHaveBeenCalled();
      expect(api.saveGuestCart).not.toHaveBeenCalled();
    },
  );
});
