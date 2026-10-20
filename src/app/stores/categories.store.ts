import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ApiError } from '../core/http/api-error';
import { CATEGORY_PAGE_SIZE } from '@constants/category.constants';
import { CategoriesService } from '@services/categories.service';
import { CategoryDto } from '@models/category.dto';

@Injectable()
export class CategoriesStore {
  private readonly service = inject(CategoriesService);
  private readonly destroyRef = inject(DestroyRef);
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
          this.errorState.set(this.errorMessage(error));
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
  parentName(parentId: string | null): string {
    return this.items().find((item) => item.id === parentId)?.name ?? '—';
  }
  delete(category: CategoryDto, done: () => void): void {
    if (this.deleting()) return;
    this.deletingState.set(true);
    this.errorState.set('');
    this.noticeState.set('');
    this.service
      .delete(category.id, category.version)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (deleted) => {
          this.deletingState.set(false);
          if (!deleted) {
            this.errorState.set('Máy chủ chưa xác nhận xóa danh mục.');
            return;
          }
          this.records.update((records) => records.filter((item) => item.id !== category.id));
          this.setPage(this.page());
          this.noticeState.set('Đã xóa danh mục.');
          done();
        },
        error: (error: unknown) => {
          this.deletingState.set(false);
          this.errorState.set(this.errorMessage(error));
        },
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
