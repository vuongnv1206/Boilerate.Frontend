import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Icon } from '@shared/ui/icon/icon.component';
import { CartStore } from '@stores/cart.store';
import { DiscountCodeComponent } from '../discount-code/discount-code.component';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [RouterLink, DecimalPipe, Icon, DiscountCodeComponent],
  templateUrl: './cart-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPageComponent implements OnInit {
  readonly cartStore = inject(CartStore);
  private readonly router = inject(Router);

  ngOnInit() {
    this.cartStore.loadCart();
  }

  onUpdateQty(variantId: string, quantity: number) {
    this.cartStore.updateQuantity(variantId, quantity);
  }

  onRemoveItem(variantId: string) {
    this.cartStore.removeItem(variantId);
  }

  onRetry() {
    this.cartStore.loadCart();
  }

  onProceedToCheckout() {
    void this.router.navigate(['/shop/checkout']);
  }
}
