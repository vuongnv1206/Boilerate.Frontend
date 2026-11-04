import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProductFulfillmentKind } from '@enums/product.enum';
import { ProductDto } from '@models/product.dto';
import { Icon } from '@shared/ui/icon/icon.component';
import { CartStore } from '@stores/cart.store';
import { StorefrontStore } from '@stores/storefront.store';
import { getStorefrontProductFallbackImage } from '@utils/storefront-image.util';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, DecimalPipe, Icon],
  providers: [StorefrontStore],
  templateUrl: './product-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailComponent implements OnInit {
  readonly storefrontStore = inject(StorefrontStore);
  readonly cartStore = inject(CartStore);
  private readonly route = inject(ActivatedRoute);

  private readonly destroyRef = inject(DestroyRef);
  readonly addedQuantity = signal(0);
  readonly quantity = signal(1);
  readonly activeImageId = signal<string | null>(null);
  readonly addedNotification = signal(false);

  readonly canAddToCart = computed(() => {
    const variant = this.storefrontStore.selectedVariant();
    return (
      variant !== null &&
      !this.cartStore.loading() &&
      !this.cartStore.uncertain() &&
      !this.cartStore.discountBusy() &&
      !this.cartStore.discountUncertain() &&
      variant.isActive &&
      variant.inStock &&
      variant.price !== null &&
      variant.price !== undefined &&
      Number.isInteger(this.quantity()) &&
      this.quantity() > 0 &&
      this.quantity() <= 999
    );
  });

  ngOnInit() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const slug = params.get('slug');
      if (slug) {
        this.storefrontStore.loadProductBySlug(slug);
        this.quantity.set(1);
        this.activeImageId.set(null);
        this.addedNotification.set(false);
      }
    });
  }

  onSelectOption(optionId: string, optionValueId: string) {
    this.storefrontStore.selectOption(optionId, optionValueId);
    const variant = this.storefrontStore.selectedVariant();
    this.activeImageId.set(variant?.imageMediaId ?? null);
  }

  onSelectMedia(mediaId: string) {
    this.activeImageId.set(mediaId);
  }

  onIncreaseQty() {
    this.quantity.update((q) => Math.min(999, q + 1));
  }

  onDecreaseQty() {
    this.quantity.update((q) => Math.max(1, q - 1));
  }

  onQtyChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const val = Number(target.value);
    this.quantity.set(val);
  }

  getProductImageSource(product: ProductDto): string | null {
    const mediaId =
      this.activeImageId() ??
      this.storefrontStore.selectedVariant()?.imageMediaId ??
      product.media[0]?.mediaAssetId;
    if (mediaId) return `/api/catalog/media/${mediaId}`;
    return getStorefrontProductFallbackImage(product.slug, product.name);
  }

  onProductImageError(event: Event, product: ProductDto) {
    const image = event.target as HTMLImageElement;
    const fallback = getStorefrontProductFallbackImage(product.slug, product.name);
    if (fallback && !image.src.endsWith(fallback)) {
      image.src = fallback;
      return;
    }

    image.hidden = true;
    image.parentElement?.classList.add('image-unavailable');
  }

  onThumbnailImageError(event: Event) {
    const image = event.target as HTMLImageElement;
    image.hidden = true;
    image.parentElement?.classList.add('thumbnail-image-unavailable');
  }

  onAddToCart(product: ProductDto) {
    const variant = this.storefrontStore.selectedVariant();
    if (!this.canAddToCart() || !variant || variant.price === null || variant.price === undefined)
      return;

    const isDigital = product.fulfillmentKind !== ProductFulfillmentKind.Physical;

    const quantity = this.quantity();
    this.addedNotification.set(false);
    this.cartStore
      .addToCart({
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
          if (this.destroyRef.destroyed || this.storefrontStore.productDetail()?.id !== product.id)
            return;
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
    return kind !== ProductFulfillmentKind.Physical;
  }

  getFulfillmentLabel(kind: ProductFulfillmentKind): string {
    switch (kind) {
      case ProductFulfillmentKind.Physical:
        return 'Hàng vật lý';
      case ProductFulfillmentKind.DigitalUnique:
        return 'Bản quyền số riêng';
      case ProductFulfillmentKind.DigitalShared:
        return 'Nội dung số dùng chung';
      case ProductFulfillmentKind.ManualExtension:
        return 'Gia hạn dịch vụ';
      default:
        return 'Sản phẩm';
    }
  }
}
