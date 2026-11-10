import { Component, DestroyRef, OnInit, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Subscription, catchError, of, tap, timer } from 'rxjs';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  ProductDto,
  ProductFulfillmentKind,
  ProductVariant,
  getFulfillmentLabel,
  getStorefrontProductFallbackImage,
  isDigitalFulfillment,
  resolveCatalogImageSource,
} from '@api/storefront/models/storefront.dto';
import { CartService } from '@api/storefront/services/cart.service';
import { PublicCatalogService } from '@api/storefront/services/public-catalog.service';

@Component({
  selector: 'app-product-detail',
  imports: [SHARED_IMPORTS],
  templateUrl: './product-detail.component.html',
})
export class ProductDetailComponent implements OnInit {
  // System variables
  private detailSubscription?: Subscription;

  // Business variables
  readonly productDetail = signal<ProductDto | null>(null);
  readonly selectedVariant = signal<ProductVariant | null>(null);
  readonly selectedOptions = signal<Readonly<Record<string, string>>>({});
  readonly detailLoading = signal(false);
  readonly detailError = signal('');

  readonly addedQuantity = signal(0);
  readonly quantity = signal(1);
  readonly activeImageId = signal<string | null>(null);
  readonly addedNotification = signal(false);

  readonly canAddToCart = computed(() => {
    const variant = this.selectedVariant();
    return (
      variant !== null &&
      !this.cartService.loading() &&
      !this.cartService.uncertain() &&
      !this.cartService.discountLoading() &&
      !this.cartService.discountUncertain() &&
      variant.isActive &&
      variant.inStock &&
      variant.price !== null &&
      variant.price !== undefined &&
      Number.isInteger(this.quantity()) &&
      this.quantity() > 0 &&
      this.quantity() <= 999
    );
  });

  constructor(
    private readonly catalogService: PublicCatalogService,
    readonly cartService: CartService,
    private readonly route: ActivatedRoute,
    private readonly destroyRef: DestroyRef,
  ) {
    this.destroyRef.onDestroy(() => this.detailSubscription?.unsubscribe());
  }

  ngOnInit(): void {
    this.route.paramMap?.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const slug = params.get('slug');
      if (slug) {
        this.loadProductBySlug(slug);
        this.quantity.set(1);
        this.activeImageId.set(null);
        this.addedNotification.set(false);
      }
    });
  }

  loadProductBySlug(slug: string): void {
    this.detailSubscription?.unsubscribe();
    this.detailLoading.set(true);
    this.detailError.set('');
    this.productDetail.set(null);
    this.selectedVariant.set(null);
    this.selectedOptions.set({});

    this.detailSubscription = this.catalogService
      .getProductBySlug(slug)
      .pipe(
        tap((product) => {
          this.productDetail.set(product);
          this.detailLoading.set(false);
          const defaultVariant =
            product.variants.find((v) => v.isDefault) ?? product.variants[0] ?? null;
          this.selectedVariant.set(defaultVariant);

          if (defaultVariant) {
            const initialOptions: Record<string, string> = {};
            for (const sel of defaultVariant.selections) {
              initialOptions[sel.optionId] = sel.optionValueId;
            }
            this.selectedOptions.set(initialOptions);
          }
        }),
        catchError((err: unknown) => {
          this.detailError.set(normalizeApiError(err).message);
          this.detailLoading.set(false);
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  onSelectOption(optionId: string, optionValueId: string): void {
    const updated: Record<string, string> = {
      ...this.selectedOptions(),
      [optionId]: optionValueId,
    };
    this.selectedOptions.set(updated);

    const product = this.productDetail();
    if (!product) return;

    const match = product.variants.find(
      (v) =>
        v.isActive &&
        v.selections.length === Object.keys(updated).length &&
        v.selections.every((s) => updated[s.optionId] === s.optionValueId),
    );
    const resolved = match ?? null;
    this.selectedVariant.set(resolved);
    this.activeImageId.set(resolved?.imageMediaId ?? null);
  }

  onSelectMedia(mediaId: string): void {
    this.activeImageId.set(mediaId);
  }

  onIncreaseQty(): void {
    this.quantity.update((q) => Math.min(999, q + 1));
  }

  onDecreaseQty(): void {
    this.quantity.update((q) => Math.max(1, q - 1));
  }

  onQtyChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.quantity.set(Number(target.value));
  }

  getProductImageSource(product: ProductDto): string | null {
    const mediaId =
      this.activeImageId() ??
      this.selectedVariant()?.imageMediaId ??
      product.media[0]?.mediaAssetId;
    return resolveCatalogImageSource(mediaId, product.slug, product.name);
  }

  onProductImageError(event: Event, product: ProductDto): void {
    const image = event.target as HTMLImageElement;
    const fallback = getStorefrontProductFallbackImage(product.slug, product.name);
    if (fallback && !image.src.endsWith(fallback)) {
      image.src = fallback;
      return;
    }

    image.hidden = true;
    image.parentElement?.classList.add('image-unavailable');
  }

  onThumbnailImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.hidden = true;
    image.parentElement?.classList.add('thumbnail-image-unavailable');
  }

  onAddToCart(product: ProductDto): void {
    const variant = this.selectedVariant();
    if (!this.canAddToCart() || !variant || variant.price === null || variant.price === undefined) {
      return;
    }

    const isDigital = isDigitalFulfillment(product.fulfillmentKind);
    const quantity = this.quantity();
    this.addedNotification.set(false);
    this.cartService
      .addItem({
        variantId: variant.id,
        productId: product.id,
        name: `${product.name} - ${variant.sku}`,
        sku: variant.sku,
        unitPrice: variant.price,
        quantity,
        isDigital,
      })
      .subscribe({
        next: () => {
          if (this.destroyRef.destroyed || this.productDetail()?.id !== product.id) {
            return;
          }
          this.addedQuantity.set(quantity);
          this.addedNotification.set(true);
          timer(4000)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.addedNotification.set(false));
        },
        error: () => undefined,
      });
  }

  isDigital(kind: ProductFulfillmentKind): boolean {
    return isDigitalFulfillment(kind);
  }

  getFulfillmentLabel(kind: ProductFulfillmentKind): string {
    return getFulfillmentLabel(kind);
  }
}
