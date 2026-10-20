import { CategoryForm } from '@forms/category.form';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, firstValueFrom } from 'rxjs';
import { ApiError } from '../core/http/api-error';
import { applyServerErrors, clearServerErrors } from '../shared/forms/apply-server-errors';
import { CategoriesService } from '@services/categories.service';
import { categoryFormValue, categoryRequest } from '@forms/category.form';
import { CategoryDto } from '@models/category.dto';

@Injectable()
export class CategoryIoStore {
  private readonly service = inject(CategoriesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recordState = signal<CategoryDto | null>(null);
  private readonly allState = signal<readonly CategoryDto[]>([]);
  private readonly loadingState = signal(false);
  private readonly savingState = signal(false);
  private readonly errorState = signal('');
  private readonly savedState = signal(false);
  private readonly readyState = signal(false);
  private loadSubscription?: Subscription;
  private generation = 0;
  private revision = 0;
  private currentId = 'new';

  private currentForm: CategoryForm | null = null;
  readonly record = this.recordState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly saved = this.savedState.asReadonly();
  readonly ready = this.readyState.asReadonly();
  readonly parentOptions = computed(() => {
    const current = this.record()?.id;
    const excluded = new Set(current ? [current] : []);
    let count = -1;
    while (count !== excluded.size) {
      count = excluded.size;
      this.allState().forEach((item) => {
        if (item.parentId && excluded.has(item.parentId)) excluded.add(item.id);
      });
    }
    return this.allState().filter((item) => !excluded.has(item.id));
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.generation++;
      this.loadSubscription?.unsubscribe();
    });
  }
  get form(): CategoryForm {
    if (!this.currentForm) throw new Error('Set the editor form before loading data.');
    return this.currentForm;
  }

  setForm(form: CategoryForm): void {
    if (this.currentForm) throw new Error('The editor form is already set.');
    this.currentForm = form;

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.revision++;
      this.savedState.set(false);
      clearServerErrors(this.form);
    });
  }

  load(id: string): void {
    this.currentId = id;
    this.readyState.set(false);
    const generation = ++this.generation;
    this.loadSubscription?.unsubscribe();
    this.loadingState.set(true);
    this.errorState.set('');
    this.recordState.set(null);
    this.savedState.set(false);
    this.savingState.set(false);
    this.form.reset(categoryFormValue(), { emitEvent: false });
    this.loadSubscription = this.service
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          if (generation !== this.generation) return;
          this.allState.set(items);
          const item = id === 'new' ? undefined : items.find((entry) => entry.id === id);
          this.loadingState.set(false);
          if (id !== 'new' && !item) {
            this.errorState.set('Không tìm thấy danh mục này.');
            return;
          }
          this.recordState.set(item ?? null);
          this.form.reset(categoryFormValue(item), { emitEvent: false });
          this.readyState.set(true);
        },
        error: (error: unknown) => {
          this.loadingState.set(false);
          this.errorState.set(
            error instanceof ApiError ? error.message : 'Không thể tải danh mục.',
          );
        },
      });
  }
  retry(): void {
    this.load(this.currentId);
  }
  async save(): Promise<CategoryDto | null> {
    if (this.saving() || this.loading() || !this.ready()) return null;
    clearServerErrors(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return null;
    }
    const generation = this.generation;
    const revision = this.revision;
    const request = categoryRequest(this.form, this.record());
    this.savingState.set(true);
    this.errorState.set('');
    this.savedState.set(false);
    try {
      const result = await firstValueFrom(
        (request.id ? this.service.update(request.id, request) : this.service.create(request)).pipe(
          takeUntilDestroyed(this.destroyRef),
        ),
      );
      if (generation !== this.generation) return null;
      this.recordState.set(result);
      if (revision === this.revision)
        this.form.reset(categoryFormValue(result), { emitEvent: false });
      this.savedState.set(revision === this.revision);
      return result;
    } catch (error: unknown) {
      if (generation !== this.generation) return null;
      if (error instanceof ApiError) {
        applyServerErrors(this.form, error.fieldErrors);
        this.errorState.set(
          error.status === 409
            ? 'Danh mục đã được người khác cập nhật. Nội dung đang nhập được giữ lại; tải lại khi sẵn sàng đối chiếu.'
            : error.message,
        );
      } else this.errorState.set('Chưa lưu được danh mục. Nội dung đang nhập được giữ lại.');
      return null;
    } finally {
      if (generation === this.generation) this.savingState.set(false);
    }
  }
}
