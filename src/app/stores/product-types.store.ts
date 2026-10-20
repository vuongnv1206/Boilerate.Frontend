import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ApiError } from '../core/http/api-error';
import { PRODUCT_TYPE_PAGE_SIZE } from '@constants/product-type.constants';
import { ProductTypesService } from '@services/product-types.service';
import { ProductTypeDto } from '@models/product-type.dto';

@Injectable()
export class ProductTypesStore {
  private readonly service = inject(ProductTypesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly records = signal<readonly ProductTypeDto[]>([]);
  private readonly queryState = signal('');
  private readonly pageState = signal(1);
  private readonly loadingState = signal(false);
  private readonly errorState = signal('');
  private loadSubscription?: Subscription;

  readonly items = this.records.asReadonly();
  readonly query = this.queryState.asReadonly();
  readonly page = this.pageState.asReadonly();
  readonly pageSize = PRODUCT_TYPE_PAGE_SIZE;
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly filtered = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('vi');
    return this.items().filter(
      (item) => !query || `${item.name} ${item.code}`.toLocaleLowerCase('vi').includes(query),
    );
  });
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize)),
  );
  readonly rows = computed(() =>
    this.filtered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize),
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.loadSubscription?.unsubscribe());
  }
  load(): void {
    this.loadSubscription?.unsubscribe();
    this.loadingState.set(true);
    this.errorState.set('');
    this.loadSubscription = this.service
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.records.set(items);
          this.setPage(this.page());
          this.loadingState.set(false);
        },
        error: (error: unknown) => {
          this.loadingState.set(false);
          this.errorState.set(
            error instanceof ApiError ? error.message : 'Không thể tải loại sản phẩm.',
          );
        },
      });
  }
  search(query: string): void {
    this.queryState.set(query);
    this.pageState.set(1);
  }
  setPage(page: number): void {
    this.pageState.set(Math.max(1, Math.min(page, this.totalPages())));
  }
}
