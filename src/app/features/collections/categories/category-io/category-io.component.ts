import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog.component';
import { LeaveConfirmation } from '@shared/ui/confirm-dialog/leave-confirmation';
import { FormErrorSummary } from '@shared/ui/form-error-summary/form-error-summary.component';
import { validationMessage } from '@shared/forms/validation-message';
import { AbstractControl } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { FieldMessage } from '@shared/ui/field-message/field-message.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { CATEGORY_LIMITS } from '@constants/category.constants';
import { CategoryForm as CategoryFormGroup, createCategoryForm } from '@forms/category.form';
import { CategoryIoStore } from '@stores/category-io.store';

@Component({
  selector: 'app-category-io',
  host: { class: 'collection-screen' },
  imports: [
    RouterLink,
    ConfirmDialog,
    FormErrorSummary,
    ContentState,
    Icon,
    ReactiveFormsModule,
    FieldMessage,
    InputText,
    Textarea,
  ],
  providers: [CategoryIoStore, LeaveConfirmation],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-io.component.html',
})
export class CategoryIo implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(CategoryIoStore);
  readonly form = createCategoryForm();
  readonly limits = CATEGORY_LIMITS;

  readonly confirmation = inject(LeaveConfirmation);

  ngOnInit(): void {
    this.store.setForm(this.form);
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? 'new'),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => this.store.load(id));
  }
  save(): void {
    const wasNew = !this.route.snapshot.paramMap.has('id');
    this.store
      .save()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        if (wasNew && !this.form.dirty)
          void this.router.navigate(['/admin/collections/categories', saved.id], {
            replaceUrl: true,
            queryParamsHandling: 'preserve',
          });
      });
  }
  async retry(): Promise<void> {
    if (await this.confirmLeave()) this.store.retry();
  }
  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(this.form.dirty, this.store.saving());
  }
  validation(control: AbstractControl): string {
    return validationMessage(control);
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
