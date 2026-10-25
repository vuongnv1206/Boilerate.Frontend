import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
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

    store.addToCart({
      variantId: 'var-1',
      productId: 'prod-1',
      name: 'Key Phần mềm',
      sku: 'KEY-01',
      unitPrice: 150000,
      quantity: 2,
      isDigital: true,
    });

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
});
