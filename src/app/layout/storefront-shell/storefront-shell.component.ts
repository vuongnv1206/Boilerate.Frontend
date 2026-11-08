import { Component, Inject, OnInit, Optional, ViewEncapsulation, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSession } from '@core/auth/auth-session';
import { STOREFRONT_CART_BADGE, StorefrontCartBadge } from '@core/navigation/storefront-cart.token';
import { SHARED_IMPORTS } from '@shared/shared-imports';

@Component({
  selector: 'app-storefront-shell',
  imports: [SHARED_IMPORTS],
  templateUrl: './storefront-shell.component.html',
  styleUrls: [
    '../../../styles/storefront/_fonts.scss',
    '../../../styles/storefront/_chrome.scss',
    '../../../styles/storefront/_catalog.scss',
    '../../../styles/storefront/_shared.scss',
    '../../../styles/storefront/_product.scss',
    '../../../styles/storefront/_checkout.scss',
    '../../../styles/storefront/_orders.scss',
    '../../../styles/storefront/_footer.scss',
    '../../../styles/storefront/_responsive.scss',
  ],
  encapsulation: ViewEncapsulation.None,
})
export class StorefrontShell implements OnInit {
  // Business variables
  readonly itemCount = computed(() => this.cartBadge?.itemCount() ?? 0);
  readonly canAccessAdmin = computed(
    () => this.authSession.isCentralAdmin() || this.authSession.permissions().length > 0,
  );

  constructor(
    public readonly authSession: AuthSession,
    @Optional()
    @Inject(STOREFRONT_CART_BADGE)
    private readonly cartBadge: StorefrontCartBadge | null,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.cartBadge?.syncOnEnter(this.authSession.signedIn());
  }

  onSignOut(): void {
    this.authSession.signOut().subscribe();
    void this.router.navigate(['/shop']);
  }
}
