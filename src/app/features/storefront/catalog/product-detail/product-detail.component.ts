import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
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
  templateUrl: './product-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailComponent implements OnInit {
  readonly storefrontStore = inject(StorefrontStore);
  readonly cartStore = inject(CartStore);
  private readonly route = inject(ActivatedRoute);

  readonly quantity = signal(1);
  readonly activeImageId = signal<string | null>(null);
  readonly addedNotification = signal(false);

  readonly canAddToCart = computed(() => {
    const variant = this.storefrontStore.selectedVariant();
    return (
      variant !== null &&
      !this.cartStore.loading() &&
      variant.inStock &&
      variant.price !== null &&
      variant.price !== undefined &&
      this.quantity() > 0
    );
  });

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (slug) {
        this.storefrontStore.loadProductBySlug(slug);
        this.quantity.set(1);
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
    this.quantity.update((q) => q + 1);
  }

  onDecreaseQty() {
    this.quantity.update((q) => Math.max(1, q - 1));
  }

  onQtyChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const val = parseInt(target.value, 10);
    this.quantity.set(isNaN(val) || val < 1 ? 1 : val);
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
    if (!variant || !variant.price) return;

    const isDigital = product.fulfillmentKind !== ProductFulfillmentKind.Physical;

    this.cartStore.addToCart({
      variantId: variant.id,
      productId: product.id,
      name: `${product.name} - ${variant.sku}`,
      sku: variant.sku,
      unitPrice: variant.price,
      quantity: this.quantity(),
      isDigital,
    });

    this.addedNotification.set(true);
    setTimeout(() => {
      this.addedNotification.set(false);
    }, 4000);
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
