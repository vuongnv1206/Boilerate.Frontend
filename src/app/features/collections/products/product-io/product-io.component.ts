import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog.component';
import { LeaveConfirmation } from '@shared/ui/confirm-dialog/leave-confirmation';
import { FormErrorSummary } from '@shared/ui/form-error-summary/form-error-summary.component';
import { validationMessage } from '@shared/forms/validation-message';
import { InputText } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { FieldMessage } from '@shared/ui/field-message/field-message.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { StatusBadge } from '@shared/ui/status-badge/status-badge.component';
import {
  PRODUCT_FULFILLMENT_OPTIONS,
  PRODUCT_LIMITS,
  PRODUCT_STATUS_LABELS,
} from '@constants/product.constants';
import { ProductFieldType } from '@enums/product-field-type.enum';
import { ProductStatus } from '@enums/product.enum';
import { createProductForm } from '@forms/product.form';
import { ProductIoStore } from '@stores/product-io.store';

@Component({
  selector: 'app-product-io',
  host: { class: 'collection-screen' },
  imports: [
    RouterLink,
    ConfirmDialog,
    FormErrorSummary,
    ContentState,
    Icon,
    CurrencyPipe,
    ReactiveFormsModule,
    InputText,
    MultiSelect,
    Select,
    Textarea,
    FieldMessage,
    StatusBadge,
  ],
  providers: [ProductIoStore, LeaveConfirmation],
  templateUrl: './product-io.component.html',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductIo implements OnInit {
  readonly store = inject(ProductIoStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly form = createProductForm();
  readonly limits = PRODUCT_LIMITS;
  readonly fieldType = ProductFieldType;
  readonly fulfillmentOptions = PRODUCT_FULFILLMENT_OPTIONS;
  readonly statuses = PRODUCT_STATUS_LABELS;
  readonly categoryOptions = computed(() => this.store.categories().slice());
  readonly typeOptions = computed(() => this.store.productTypes().slice());

  readonly confirmation = inject(LeaveConfirmation);
  readonly status = ProductStatus;
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.store.setForm(this.form);
    const destroyRef = this.destroyRef;
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        takeUntilDestroyed(destroyRef),
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
          void this.router.navigate(['/admin/collections/products', saved.id], {
            replaceUrl: true,
            queryParamsHandling: 'preserve',
          });
      });
  }

  retry(): void {
    this.store.load(this.route.snapshot.paramMap.get('id'));
  }

  async reload(): Promise<void> {
    if (await this.confirmLeave()) this.retry();
  }

  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(this.form.dirty, this.store.busy());
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.hasUnsavedChanges()) event.preventDefault();
  }

  error(control: AbstractControl | undefined): string {
    return validationMessage(control);
  }
}
