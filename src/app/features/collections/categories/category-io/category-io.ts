import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { ContentState } from '@shared/ui/content-state/content-state';
import { FieldMessage } from '@shared/ui/field-message/field-message';
import { Icon } from '@shared/ui/icon/icon';
import { CATEGORY_LIMITS } from '@constants/category.constants';
import { CategoryForm as CategoryFormGroup, createCategoryForm } from '@forms/category.form';
import { CategoryIoStore } from '@stores/category-io.store';

@Component({
  selector: 'app-category-io',
  host: { class: 'collection-screen' },
  imports: [
    RouterLink,
    Dialog,
    ContentState,
    Icon,
    ReactiveFormsModule,
    FieldMessage,
    InputText,
    Textarea,
  ],
  providers: [CategoryIoStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-io.html',
})
export class CategoryIo {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(CategoryIoStore);
  readonly form = createCategoryForm();
  readonly limits = CATEGORY_LIMITS;

  readonly leaveOpen = signal(false);
  private leaveResolver?: (leave: boolean) => void;

  constructor() {
    this.store.setForm(this.form);
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? 'new'),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => this.store.load(id));
    this.destroyRef.onDestroy(() => this.leaveResolver?.(false));
  }
  async save(): Promise<void> {
    const wasNew = !this.route.snapshot.paramMap.has('id');
    const saved = await this.store.save();
    if (saved && wasNew && !this.form.dirty)
      void this.router.navigate(['/admin/collections/categories', saved.id], { replaceUrl: true });
  }
  async retry(): Promise<void> {
    if (await this.confirmLeave()) this.store.retry();
  }
  confirmLeave(): boolean | Promise<boolean> {
    if (this.store.saving()) return false;
    if (!this.form.dirty) return true;
    this.leaveOpen.set(true);
    return new Promise<boolean>((resolve) => {
      this.leaveResolver = resolve;
    });
  }
  resolveLeave(leave: boolean): void {
    this.leaveOpen.set(false);
    this.leaveResolver?.(leave);
    this.leaveResolver = undefined;
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty || this.store.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  invalid(field: keyof CategoryFormGroup['controls']): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }
  serverError(field: keyof CategoryFormGroup['controls']): string {
    const errors: unknown = this.form.controls[field].errors?.['server'];
    return Array.isArray(errors) ? errors.join(' ') : '';
  }
}
