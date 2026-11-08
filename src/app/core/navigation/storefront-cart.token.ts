import { InjectionToken, Signal } from '@angular/core';

export interface StorefrontCartBadge {
  readonly itemCount: Signal<number>;
  syncOnEnter(signedIn: boolean): void;
}

export const STOREFRONT_CART_BADGE = new InjectionToken<StorefrontCartBadge>(
  'Storefront cart badge',
);
