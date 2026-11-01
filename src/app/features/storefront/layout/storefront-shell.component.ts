import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewEncapsulation,
  computed,
  inject,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthSession } from '@core/auth/auth-session';
import { Icon } from '@shared/ui/icon/icon.component';
import { CartStore } from '@stores/cart.store';

@Component({
  selector: 'app-storefront-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Icon],
  templateUrl: './storefront-shell.component.html',
  styleUrls: [
    '../../../../styles/storefront/_fonts.scss',
    '../../../../styles/storefront/_chrome.scss',
    '../../../../styles/storefront/_catalog.scss',
    '../../../../styles/storefront/_shared.scss',
    '../../../../styles/storefront/_product.scss',
    '../../../../styles/storefront/_checkout.scss',
    '../../../../styles/storefront/_orders.scss',
    '../../../../styles/storefront/_footer.scss',
    '../../../../styles/storefront/_responsive.scss',
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorefrontShellComponent implements OnInit {
  readonly authSession = inject(AuthSession);
  readonly cartStore = inject(CartStore);
  private readonly router = inject(Router);

  readonly canAccessAdmin = computed(
    () => this.authSession.isCentralAdmin() || this.authSession.permissions().length > 0,
  );

  ngOnInit() {
    if (this.authSession.signedIn()) {
      this.cartStore.syncGuestCartOnLogin();
    } else {
      this.cartStore.loadCart();
    }
  }

  onSignOut() {
    this.authSession.clear();
    void this.router.navigate(['/shop']);
  }
}
