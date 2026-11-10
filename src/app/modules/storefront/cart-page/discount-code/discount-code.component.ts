import { Component, input, signal } from '@angular/core';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { CartService } from '@api/storefront/services/cart.service';

@Component({
  selector: 'app-discount-code',
  imports: [SHARED_IMPORTS],
  templateUrl: './discount-code.component.html',
})
export class DiscountCodeComponent {
  // System variables
  readonly disabled = input(false);

  // Business variables
  readonly code = signal('');

  constructor(readonly cartService: CartService) {}

  onInput(event: Event): void {
    this.code.set((event.target as HTMLInputElement).value);
  }

  apply(): void {
    const trimmed = this.code().trim();
    if (trimmed) {
      this.cartService.applyDiscount(trimmed);
    }
  }

  remove(): void {
    this.cartService.removeDiscount();
  }
}
