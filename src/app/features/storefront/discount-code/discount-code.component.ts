import { ChangeDetectionStrategy, Component, input, inject, signal } from '@angular/core';
import { CartStore } from '@stores/cart.store';

@Component({
  selector: 'app-discount-code',
  standalone: true,
  templateUrl: './discount-code.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscountCodeComponent {
  readonly disabled = input(false);
  readonly cartStore = inject(CartStore);
  readonly code = signal('');

  onInput(event: Event) {
    this.code.set((event.target as HTMLInputElement).value);
  }

  apply() {
    const code = this.code().trim();
    if (code) this.cartStore.setDiscount(code);
  }

  remove() {
    this.cartStore.setDiscount(null);
  }
}
