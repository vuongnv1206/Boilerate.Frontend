import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductDetailComponent } from '@features/storefront/catalog/product-detail/product-detail.component';
import { ProductDto, ProductVariant } from '@models/product.dto';
import { CartDto } from '@models/cart.dto';
import { CartStore } from '@stores/cart.store';
import { StorefrontStore } from '@stores/storefront.store';

describe('Storefront purchase feedback', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('allows a zero-price SKU and announces only the saved quantity after success', () => {
    const result = new Subject<CartDto>();
    const product = { id: 'p', fulfillmentKind: 1 } as ProductDto;
    const variant = {
      id: 'v',
      price: 0,
      sku: 'FREE',
      isActive: true,
      inStock: true,
    } as ProductVariant;
    const cart = {
      loading: signal(false),
      uncertain: signal(false),
      discountBusy: signal(false),
      discountUncertain: signal(false),
      addToCart: vi.fn(() => result),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: {} },
        {
          provide: StorefrontStore,
          useValue: { selectedVariant: signal(variant), productDetail: signal(product) },
        },
        { provide: CartStore, useValue: cart },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new ProductDetailComponent());
    expect(component.canAddToCart()).toBe(true);
    component.quantity.set(2);
    component.onAddToCart(product);
    expect(component.addedNotification()).toBe(false);
    component.quantity.set(3);
    result.next({} as CartDto);
    expect(component.addedNotification()).toBe(true);
    expect(component.addedQuantity()).toBe(2);
    component.quantity.set(1.5);
    expect(component.canAddToCart()).toBe(false);
    component.quantity.set(1000);
    expect(component.canAddToCart()).toBe(false);
  });
});
