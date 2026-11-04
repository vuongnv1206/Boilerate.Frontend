import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Subscription, catchError, of, tap } from 'rxjs';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { CategoryDto } from '@models/category.dto';
import { ProductDto, ProductPage, ProductSearch, ProductVariant } from '@models/product.dto';
import { StorefrontService } from '@services/storefront.service';

const EMPTY_PAGE: ProductPage = {
  items: [],
  total: 0,
  pageNumber: 1,
  pageSize: 20,
};

@Injectable({ providedIn: 'root' })
export class StorefrontStore {
  private readonly storefrontService = inject(StorefrontService);

  private searchSubscription?: Subscription;
  private detailSubscription?: Subscription;
  private readonly detailLoadingState = signal(false);
  private readonly detailErrorState = signal('');
  readonly detailLoading = this.detailLoadingState.asReadonly();
  readonly detailError = this.detailErrorState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.searchSubscription?.unsubscribe();
      this.detailSubscription?.unsubscribe();
    });
  }

  private readonly pageState = signal<ProductPage>(EMPTY_PAGE);
  private readonly categoriesState = signal<readonly CategoryDto[]>([]);
  private readonly selectedCategoryState = signal<string | null>(null);
  private readonly searchQueryState = signal<string>('');
  private readonly loadingState = signal(false);
  private readonly errorState = signal('');
  private readonly productDetailState = signal<ProductDto | null>(null);
  private readonly selectedVariantState = signal<ProductVariant | null>(null);
  private readonly selectedOptionsState = signal<Record<string, string>>({});

  readonly page = this.pageState.asReadonly();
  readonly categories = this.categoriesState.asReadonly();
  readonly selectedCategoryId = this.selectedCategoryState.asReadonly();
  readonly searchQuery = this.searchQueryState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly productDetail = this.productDetailState.asReadonly();
  readonly selectedVariant = this.selectedVariantState.asReadonly();
  readonly selectedOptions = this.selectedOptionsState.asReadonly();

  readonly hasProducts = computed(() => this.pageState().items.length > 0);
  readonly totalPages = computed(() =>
    Math.ceil(this.pageState().total / Math.max(1, this.pageState().pageSize)),
  );

  loadCategories() {
    this.storefrontService
      .getCategories()
      .pipe(
        tap((categories) => this.categoriesState.set(categories)),
        catchError(() => of([])),
      )
      .subscribe();
  }

  search(options?: { categoryId?: string | null; search?: string; pageNumber?: number }) {
    if (options?.categoryId !== undefined) {
      this.selectedCategoryState.set(options.categoryId);
    }
    if (options?.search !== undefined) {
      this.searchQueryState.set(options.search);
    }

    this.searchSubscription?.unsubscribe();
    const currentPage = options?.pageNumber ?? this.pageState().pageNumber;
    const request: ProductSearch = {
      pageNumber: currentPage,
      pageSize: 20,
      search: this.searchQueryState() || undefined,
      categoryId: this.selectedCategoryState() || undefined,
      sortBy: 'modified',
      sortDirection: 'desc',
    };

    this.loadingState.set(true);
    this.errorState.set('');
    this.searchSubscription = this.storefrontService
      .searchProducts(request)
      .pipe(
        tap((result) => {
          this.pageState.set(result);
          this.loadingState.set(false);
        }),
        catchError((err: unknown) => {
          this.errorState.set(normalizeApiError(err).message);
          this.loadingState.set(false);
          return of(EMPTY_PAGE);
        }),
      )
      .subscribe();
  }

  loadProductBySlug(slug: string) {
    this.detailSubscription?.unsubscribe();
    this.detailLoadingState.set(true);
    this.detailErrorState.set('');
    this.productDetailState.set(null);
    this.selectedVariantState.set(null);
    this.selectedOptionsState.set({});

    this.detailSubscription = this.storefrontService
      .getProductBySlug(slug)
      .pipe(
        tap((product) => {
          this.productDetailState.set(product);
          this.detailLoadingState.set(false);
          // Pick default variant or first variant
          const defaultVariant =
            product.variants.find((v) => v.isDefault) ?? product.variants[0] ?? null;
          this.selectedVariantState.set(defaultVariant);

          if (defaultVariant) {
            const initialOptions: Record<string, string> = {};
            for (const sel of defaultVariant.selections) {
              initialOptions[sel.optionId] = sel.optionValueId;
            }
            this.selectedOptionsState.set(initialOptions);
          }
        }),
        catchError((err: unknown) => {
          this.detailErrorState.set(normalizeApiError(err).message);
          this.detailLoadingState.set(false);
          return of(null);
        }),
      )
      .subscribe();
  }

  selectOption(optionId: string, optionValueId: string) {
    const updated = { ...this.selectedOptionsState(), [optionId]: optionValueId };
    this.selectedOptionsState.set(updated);

    const product = this.productDetailState();
    if (!product) return;

    // Find variant matching updated selections
    const match = product.variants.find(
      (v) =>
        v.isActive &&
        v.selections.length === Object.keys(updated).length &&
        v.selections.every((s) => updated[s.optionId] === s.optionValueId),
    );
    this.selectedVariantState.set(match ?? null);
  }

  selectVariant(variant: ProductVariant) {
    this.selectedVariantState.set(variant);
    const initialOptions: Record<string, string> = {};
    for (const sel of variant.selections) {
      initialOptions[sel.optionId] = sel.optionValueId;
    }
    this.selectedOptionsState.set(initialOptions);
  }
}
