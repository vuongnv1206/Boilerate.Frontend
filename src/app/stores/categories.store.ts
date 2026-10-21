import { ListQuery } from '@models/list-query.model';
import { AuthSession } from '@core/auth/auth-session';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subscription, catchError, defer, finalize, take, tap } from 'rxjs';
import { ApiError } from '@core/http/api-error';
import { CATEGORY_PAGE_SIZE } from '@constants/category.constants';
import { CategoriesService } from '@services/categories.service';
import { CategoryDto } from '@models/category.dto';

@Injectable()
export class CategoriesStore {
  private readonly session = inject(AuthSession);
  readonly canCreate = computed(() => this.session.can('Category', 'Create'));
  readonly canDelete = computed(() => this.session.can('Category', 'Delete'));
  private readonly service = inject(CategoriesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadedState = signal(false);
  readonly loaded = this.loadedState.asReadonly();
  private readonly records = signal<readonly CategoryDto[]>([]);
  private readonly queryState = signal('');
  private readonly pageState = signal(1);
  private readonly loadingState = signal(false);
  private readonly deletingState = signal(false);
  private readonly errorState = signal('');
  private readonly noticeState = signal('');
  private loadSubscription?: Subscription;

  readonly items = this.records.asReadonly();
  readonly query = this.queryState.asReadonly();
  readonly page = this.pageState.asReadonly();
  readonly pageSize = CATEGORY_PAGE_SIZE;
  readonly loading = this.loadingState.asReadonly();
  readonly deleting = this.deletingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly notice = this.noticeState.asReadonly();
  readonly filtered = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('vi');
    return this.items().filter(
      (item) => !query || `${item.name} ${item.slug}`.toLocaleLowerCase('vi').includes(query),
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
          this.records.set(items);
          this.loadedState.set(true);

          this.loadingState.set(false);
        },
        error: (error: unknown) => {
          this.loadingState.set(false);
          this.errorState.set(this.errorMessage(error));
        },
      });
  }

  parentName(parentId: string | null): string {
    return this.items().find((item) => item.id === parentId)?.name ?? '—';
  }
  delete(category: CategoryDto): Observable<boolean> {
    return defer(() => {
      if (!this.canDelete() || this.deleting()) return EMPTY;
      this.deletingState.set(true);
      this.errorState.set('');
      this.noticeState.set('');
      return this.service.delete(category.id, category.version).pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        tap((deleted) => {
          if (!deleted) {
            this.errorState.set('Máy chủ chưa xác nhận xóa danh mục.');
            return;
          }
          this.records.update((records) => records.filter((item) => item.id !== category.id));
          this.noticeState.set('Đã xóa danh mục.');
        }),
        catchError((error: unknown) => {
          this.errorState.set(this.errorMessage(error));
          return EMPTY;
        }),
        finalize(() => this.deletingState.set(false)),
      );
    });
  }
  private errorMessage(error: unknown): string {
    if (error instanceof ApiError && error.status === 409)
      return 'Danh mục đã thay đổi hoặc đang được sử dụng. Tải lại để kiểm tra trước khi xóa.';
    return error instanceof ApiError
      ? error.message
      : 'Không thể tải hoặc thay đổi danh mục. Vui lòng thử lại.';
  }
}
