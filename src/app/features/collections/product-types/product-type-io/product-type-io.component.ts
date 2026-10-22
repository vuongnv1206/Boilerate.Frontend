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
import { DatePipe } from '@angular/common';
import { distinctUntilChanged, map } from 'rxjs';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog.component';
import { LeaveConfirmation } from '@shared/ui/confirm-dialog/leave-confirmation';
import { FormErrorSummary } from '@shared/ui/form-error-summary/form-error-summary.component';
import { validationMessage } from '@shared/forms/validation-message';
import { AbstractControl } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { FieldMessage } from '@shared/ui/field-message/field-message.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { PRODUCT_FIELD_TYPE_OPTIONS, PRODUCT_TYPE_LIMITS } from '@constants/product-type.constants';
import { ProductFieldType } from '@enums/product-field-type.enum';
import { createProductTypeForm } from '@forms/product-type.form';
import { ProductTypeIoStore } from '@stores/product-type-io.store';
import { ProductTypesStore } from '@stores/product-types.store';

@Component({
  selector: 'app-product-type-io',
  host: { class: 'collection-screen' },
  imports: [
    RouterLink,
    DatePipe,
    ConfirmDialog,
    FormErrorSummary,
    ContentState,
    Icon,
    ReactiveFormsModule,
    FieldMessage,
    InputText,
  ],
  providers: [ProductTypeIoStore, LeaveConfirmation],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-type-io.component.html',
})
export class ProductTypeIo implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(ProductTypeIoStore);
  private readonly listStore = inject(ProductTypesStore);
  readonly form = createProductTypeForm();
  readonly limits = PRODUCT_TYPE_LIMITS;
  readonly fieldTypes = PRODUCT_FIELD_TYPE_OPTIONS;
  readonly fieldType = ProductFieldType;

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
        this.listStore.upsert(saved);
        if (wasNew && !this.form.dirty)
          void this.router.navigate(['/admin/collections/product-types', saved.id], {
            replaceUrl: true,
            queryParamsHandling: 'preserve',
          });
      });
  }
  async retry(): Promise<void> {
    if (await this.confirmLeave()) this.store.retry();
  }
  async duplicate(): Promise<void> {
    const record = this.store.record();
    if (!record || !this.store.canCreate() || this.store.saving()) return;
    if (!(await this.confirmLeave())) return;
    this.store
      .duplicate()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((copy) => {
        this.listStore.upsert(copy);
        void this.router.navigate(['/admin/collections/product-types', copy.id], {
          queryParamsHandling: 'preserve',
        });
      });
  }
  retryProducts(): void {
    this.store.retryProducts();
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

  invalid(field: 'code' | 'name'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }
  serverError(field: 'code' | 'name'): string {
    const errors: unknown = this.form.controls[field].errors?.['server'];
    return Array.isArray(errors) ? errors.join(' ') : '';
  }

  typeLabel(type: ProductFieldType): string {
    return this.fieldTypes.find((option) => option.value === type)?.label ?? 'Không xác định';
  }
}
