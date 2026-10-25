import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductFulfillmentKind } from '@enums/product.enum';
import { ProductSummary } from '@models/product.dto';
import { Icon } from '@shared/ui/icon/icon.component';
import { StorefrontStore } from '@stores/storefront.store';
import { getStorefrontProductFallbackImage } from '@utils/storefront-image.util';

@Component({
  selector: 'app-catalog-list',
  standalone: true,
  imports: [RouterLink, DecimalPipe, Icon],
  templateUrl: './catalog-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogListComponent implements OnInit {
  readonly storefrontStore = inject(StorefrontStore);

  ngOnInit() {
    this.storefrontStore.loadCategories();
    this.storefrontStore.search();
  }

  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.storefrontStore.search({ search: target.value, pageNumber: 1 });
  }

  onSelectCategory(categoryId: string | null) {
    this.storefrontStore.search({ categoryId, pageNumber: 1 });
  }

  onPageChange(pageNumber: number) {
    this.storefrontStore.search({ pageNumber });
  }

  onResetFilters() {
    this.storefrontStore.search({ categoryId: null, search: '', pageNumber: 1 });
  }

  onRetry() {
    this.storefrontStore.search();
  }

  getProductImageSource(product: ProductSummary): string | null {
    if (product.thumbnailMediaId) return `/api/catalog/media/${product.thumbnailMediaId}`;
    return getStorefrontProductFallbackImage(product.slug, product.name);
  }

  onProductImageError(event: Event, product: ProductSummary) {
    const image = event.target as HTMLImageElement;
    const fallback = getStorefrontProductFallbackImage(product.slug, product.name);
    if (fallback && !image.src.endsWith(fallback)) {
      image.src = fallback;
      return;
    }

    image.hidden = true;
    image.parentElement?.classList.add('image-unavailable');
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
