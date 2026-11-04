import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, map, switchMap, timer } from 'rxjs';
import { ProductFulfillmentKind } from '@enums/product.enum';
import { ProductSummary } from '@models/product.dto';
import { Icon } from '@shared/ui/icon/icon.component';
import { StorefrontStore } from '@stores/storefront.store';
import { getStorefrontProductFallbackImage } from '@utils/storefront-image.util';

@Component({
  selector: 'app-catalog-list',
  standalone: true,
  imports: [RouterLink, DecimalPipe, Icon],
  providers: [StorefrontStore],
  templateUrl: './catalog-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogListComponent implements OnInit {
  readonly storefrontStore = inject(StorefrontStore);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly searchDraft = signal('');
  private readonly changes = new Subject<{
    search: string;
    categoryId: string | null;
    page: number;
    delay: number;
  }>();

  ngOnInit(): void {
    this.storefrontStore.loadCategories();
    this.changes
      .pipe(
        switchMap((query) => timer(query.delay).pipe(map(() => query))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((query) => {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {
            search: query.search.trim() || null,
            categoryId: query.categoryId,
            page: query.page > 1 ? query.page : null,
          },
        });
      });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const search = params.get('search') ?? '';
      const page = Number(params.get('page') ?? 1);
      const category = params.get('categoryId');
      const categoryId =
        category && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category)
          ? category
          : null;
      this.searchDraft.set(search);
      this.storefrontStore.search({
        search,
        categoryId,
        pageNumber: Number.isSafeInteger(page) && page > 0 ? page : 1,
      });
    });
  }

  onSearchInput(event: Event): void {
    this.searchDraft.set((event.target as HTMLInputElement).value);
    this.changes.next({
      search: this.searchDraft(),
      categoryId: this.storefrontStore.selectedCategoryId(),
      page: 1,
      delay: 300,
    });
  }

  onSelectCategory(categoryId: string | null): void {
    this.changes.next({ search: this.searchDraft(), categoryId, page: 1, delay: 0 });
  }

  onPageChange(page: number): void {
    this.changes.next({
      search: this.searchDraft(),
      categoryId: this.storefrontStore.selectedCategoryId(),
      page,
      delay: 0,
    });
  }

  onResetFilters(): void {
    this.searchDraft.set('');
    this.changes.next({ search: '', categoryId: null, page: 1, delay: 0 });
  }

  onRetry(): void {
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
