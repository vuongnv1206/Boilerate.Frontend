import { ListQuery } from '@models/list-query.model';
import { AuthSession } from '@core/auth/auth-session';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ApiError } from '@core/http/api-error';
import { PRODUCT_TYPE_PAGE_SIZE } from '@constants/product-type.constants';
import { ProductTypesService } from '@services/product-types.service';
import { ProductTypeDto } from '@models/product-type.dto';

@Injectable()
export class ProductTypesStore {
  private readonly session = inject(AuthSession);
  readonly canView = computed(() => this.session.can('ProductType', 'View'));
  readonly canCreate = computed(() => this.session.can('ProductType', 'Create'));
  private readonly service = inject(ProductTypesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadedState = signal(false);
  readonly loaded = this.loadedState.asReadonly();
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
  applyQuery(query: ListQuery): void {
    this.queryState.set(query.q);
    this.pageState.set(query.page);
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
          this.records.set(
            [...items].sort((left, right) => left.name.localeCompare(right.name, 'vi')),
          );
          this.loadedState.set(true);

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

  upsert(item: ProductTypeDto): void {
    this.records.update((records) => {
      const updated = records.some((current) => current.id === item.id)
        ? records.map((current) => (current.id === item.id ? item : current))
        : [...records, item];
      return updated.sort((left, right) => left.name.localeCompare(right.name, 'vi'));
    });
    this.loadedState.set(true);
  }
}
