import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { CartService } from '@api/storefront/services/cart.service';
import { DiscountCodeComponent } from './discount-code/discount-code.component';

@Component({
  selector: 'app-cart-page',
  imports: [SHARED_IMPORTS, DiscountCodeComponent],
  templateUrl: './cart-page.component.html',
})
export class CartPageComponent implements OnInit {
  constructor(
    readonly cartService: CartService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.cartService.loadCart();
  }

  onUpdateQty(variantId: string, quantity: number): void {
    this.cartService.updateQuantity(variantId, quantity);
  }

  onRemoveItem(variantId: string): void {
    this.cartService.removeItem(variantId);
  }

  onRetry(): void {
    this.cartService.loadCart();
  }

  onProceedToCheckout(): void {
    void this.router.navigate(['/shop/checkout']);
  }
}
