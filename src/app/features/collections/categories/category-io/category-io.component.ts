import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  HostListener,
  Injector,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Select } from 'primeng/select';
import { distinctUntilChanged, map } from 'rxjs';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog.component';
import { LeaveConfirmation } from '@shared/ui/confirm-dialog/leave-confirmation';
import { FormErrorSummary } from '@shared/ui/form-error-summary/form-error-summary.component';
import { validationMessage } from '@shared/forms/validation-message';
import { AbstractControl } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Dialog } from 'primeng/dialog';
import { AutoComplete } from 'primeng/autocomplete';
import type {
  AutoCompleteCompleteEvent,
  AutoCompleteSelectEvent,
} from 'primeng/types/autocomplete';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { FieldMessage } from '@shared/ui/field-message/field-message.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { CATEGORY_LIMITS } from '@constants/category.constants';
import { CategoryForm as CategoryFormGroup, createCategoryForm } from '@forms/category.form';
import { ProductSummary } from '@models/product.dto';
import { CategoryIoStore } from '@stores/category-io.store';
import { CategoriesStore } from '@stores/categories.store';

@Component({
  selector: 'app-category-io',
  host: { class: 'collection-screen' },
  imports: [
    ButtonDirective,
    Checkbox,
    Select,
    RouterLink,
    ConfirmDialog,
    FormErrorSummary,
    ContentState,
    Icon,
    ReactiveFormsModule,
    FieldMessage,
    InputText,
    Textarea,
    Dialog,
    AutoComplete,
  ],
  providers: [CategoryIoStore, LeaveConfirmation],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-io.component.html',
})
export class CategoryIo implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly productPicker = viewChild(AutoComplete);
  readonly store = inject(CategoryIoStore);
  readonly categories = inject(CategoriesStore);
  readonly form = createCategoryForm();
  readonly limits = CATEGORY_LIMITS;
  readonly productSearch = new FormControl<string | ProductSummary | null>(null);
  readonly productSuggestions = signal<ProductSummary[]>([]);
  readonly parentOptions = computed(() => [
    { id: '', label: 'Không có danh mục cha' },
    ...this.store.parentOptions().map((parent) => ({
      id: parent.id,
      label: this.store.categoryPath(parent.id),
    })),
  ]);

  readonly confirmation = inject(LeaveConfirmation);
  readonly deleteVisible = signal(false);

  constructor() {
    // AutoComplete expects a new suggestions array after its async query completes.
    effect(() => {
      if (this.store.productSearchLoading()) return;
      this.productSuggestions.set(
        this.store.productSearchError() ? [] : [...this.store.availableProducts()],
      );
      // Reposition after async results change the height of an upward-opening panel.
      afterNextRender(() => this.productPicker()?.overlayViewChild()?.alignOverlay(), {
        injector: this.injector,
      });
    });
  }

  ngOnInit(): void {
    this.store.setForm(this.form);
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? 'new'),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        this.productSearch.reset(null, { emitEvent: false });
        this.store.load(id);
      });
  }
  save(): void {
    const wasNew = !this.route.snapshot.paramMap.has('id');
    this.store
      .save()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        this.categories.upsert(saved);
        this.categories.load();
        if (wasNew && !this.form.dirty)
          void this.router.navigate(['/admin/collections/categories', saved.id], {
            replaceUrl: true,
            queryParamsHandling: 'preserve',
          });
      });
  }
  searchProducts(event: AutoCompleteCompleteEvent): void {
    this.store.searchProducts(event.query);
  }
  selectProduct(event: AutoCompleteSelectEvent): void {
    const product = event.value as ProductSummary;
    this.store.addProduct(product);
    if (product.version) {
      this.productSearch.reset(null, { emitEvent: false });
      this.store.searchProducts('');
    }
  }
  archive(): void {
    if (!this.store.canWrite() || !this.form.controls.isActive.value) return;
    this.form.controls.isActive.setValue(false);
    this.save();
  }
  duplicate(): void {
    this.store
      .duplicate()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((copy) => {
        this.categories.upsert(copy);
        this.categories.load();
        void this.router.navigate(['/admin/collections/categories', copy.id], {
          queryParamsHandling: 'preserve',
        });
      });
  }
  delete(): void {
    const record = this.store.record();
    if (!record || !this.categories.canDelete()) return;
    this.categories
      .delete(record)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((deleted) => {
        if (!deleted) return;
        this.deleteVisible.set(false);
        void this.router.navigate(['/admin/collections/categories'], {
          queryParamsHandling: 'preserve',
        });
      });
  }
  categoryUrlPreview(): string {
    return `/category/${this.form.controls.slug.value.trim() || 'slug'}`;
  }
  activityDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.valueOf())
      ? '—'
      : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
  async retry(): Promise<void> {
    if (await this.confirmLeave()) this.store.retry();
  }
  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(
      this.form.dirty ||
        this.store.productsDirty() ||
        this.store.productReconcileRequired() ||
        this.store.productIssues().length > 0,
      this.store.saving(),
    );
  }
  validation(control: AbstractControl): string {
    return validationMessage(control);
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (
      this.form.dirty ||
      this.store.productsDirty() ||
      this.store.productReconcileRequired() ||
      this.store.productIssues().length ||
      this.store.saving()
    ) {
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
