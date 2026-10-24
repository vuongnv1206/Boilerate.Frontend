import { ButtonDirective } from 'primeng/button';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { defaultIfEmpty, distinctUntilChanged, firstValueFrom, map } from 'rxjs';
import { Dialog } from 'primeng/dialog';
import { FormErrorSummary } from '@shared/ui/form-error-summary/form-error-summary.component';
import { validationMessage } from '@shared/forms/validation-message';
import { InputText } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
import { Checkbox } from 'primeng/checkbox';
import { DatePicker } from 'primeng/datepicker';
import { Textarea } from 'primeng/textarea';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { FieldMessage } from '@shared/ui/field-message/field-message.component';
import { FormField } from '@shared/ui/form-field/form-field.component';
import { Icon } from '@shared/ui/icon/icon.component';
import {
  PRODUCT_FULFILLMENT_OPTIONS,
  PRODUCT_LIMITS,
  PRODUCT_STATUS_LABELS,
} from '@constants/product.constants';
import { ProductFieldType } from '@enums/product-field-type.enum';
import { ProductStatus } from '@enums/product.enum';
import { createProductForm } from '@forms/product.form';
import { ProductCommerce } from '../product-commerce/product-commerce.component';
import { ProductIoStore } from '@stores/product-io.store';
import { ProductsStore } from '@stores/products.store';
import { ProductMedia } from '@models/product.dto';
import { createProductMediaForm } from '@forms/product.form';

@Component({
  selector: 'app-product-io',
  host: { class: 'collection-screen' },
  imports: [
    RouterLink,
    Dialog,
    FormErrorSummary,
    ContentState,
    Icon,
    DatePipe,
    ReactiveFormsModule,
    FormsModule,
    InputText,
    MultiSelect,
    Select,
    InputNumber,
    Checkbox,
    DatePicker,
    Textarea,
    FieldMessage,
    FormField,
    ProductCommerce,
    ButtonDirective,
  ],
  providers: [ProductIoStore],
  templateUrl: './product-io.component.html',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductIo implements OnInit {
  readonly store = inject(ProductIoStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly form = createProductForm();
  readonly commerceBusy = signal(false);
  readonly commerceDraft = signal(false);
  readonly mediaBusy = signal(false);
  readonly leaveVisible = signal(false);
  readonly deleteVisible = signal(false);
  private leaveResolve: ((value: boolean) => void) | null = null;
  readonly commerce = viewChild(ProductCommerce);
  private readonly products = inject(ProductsStore, { optional: true });
  readonly limits = PRODUCT_LIMITS;
  readonly fieldType = ProductFieldType;
  readonly fulfillmentOptions = PRODUCT_FULFILLMENT_OPTIONS;
  readonly statuses = PRODUCT_STATUS_LABELS;
  readonly categoryOptions = computed(() => this.store.categories().slice());
  readonly typeOptions = computed(() => this.store.productTypes().slice());

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
      .subscribe((id) =>
        this.store.load(id, id ? null : this.route.snapshot.queryParamMap.get('duplicateFrom')),
      );
    this.destroyRef.onDestroy(() => {
      this.leaveResolve?.(false);
      this.leaveResolve = null;
    });
  }

  save(): void {
    if (!this.prepareSave()) return;
    const wasNew = !this.route.snapshot.paramMap.has('id');
    this.store
      .save()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        this.products?.load();
        if (wasNew && !this.form.dirty)
          void this.router.navigate(['/admin/collections/products', saved.id], {
            replaceUrl: true,
            queryParams: { duplicateFrom: null },
            queryParamsHandling: 'merge',
          });
      });
  }

  deleteProduct(): void {
    this.store
      .deleteProduct()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.deleteVisible.set(false);
        this.form.markAsPristine();
        this.products?.load();
        void this.router.navigate(['/admin/collections/products']);
      });
  }

  retry(): void {
    this.store.load(this.route.snapshot.paramMap.get('id'));
  }

  async reload(): Promise<void> {
    if (await this.confirmLeave()) this.retry();
  }

  confirmLeave(): boolean | Promise<boolean> {
    if (this.store.busy() || this.commerceBusy() || this.mediaBusy()) return false;
    if (!this.form.dirty && !this.commerceDraft()) return true;
    if (this.leaveResolve) return false;
    this.leaveVisible.set(true);
    return new Promise<boolean>((resolve) => {
      this.leaveResolve = resolve;
    });
  }

  async answerLeave(choice: 'save' | 'discard' | 'stay'): Promise<void> {
    if (!this.leaveResolve || this.store.busy()) return;
    if (choice === 'save') {
      if (!this.prepareSave()) return;
      const saved = await firstValueFrom(
        this.store.save().pipe(takeUntilDestroyed(this.destroyRef), defaultIfEmpty(null)),
      );
      if (!saved || this.form.dirty) return;
      this.products?.load();
    }
    if (choice === 'discard') {
      this.commerce()?.resetDraft();
      this.store.discard();
    }
    const resolve = this.leaveResolve;
    this.leaveResolve = null;
    this.leaveVisible.set(false);
    resolve(choice !== 'stay');
  }

  async discardChanges(): Promise<void> {
    if (await this.confirmLeave()) this.store.discard();
  }

  mediaChanged(media: readonly ProductMedia[]): void {
    this.form.controls.media.clear({ emitEvent: false });
    media.forEach((item) =>
      this.form.controls.media.push(createProductMediaForm(item), { emitEvent: false }),
    );
    for (const row of this.form.controls.variants.controls)
      if (
        row.controls.imageMediaId.value &&
        !media.some((item) => item.mediaAssetId === row.controls.imageMediaId.value)
      )
        row.controls.imageMediaId.setValue(null, { emitEvent: false });
    this.form.markAsDirty();
    this.form.updateValueAndValidity();
  }

  private prepareSave(): boolean {
    if (this.commerceBusy() || this.mediaBusy()) return false;
    const commerce = this.commerce();
    if (commerce && !commerce.finishOption()) return false;
    if (commerce?.expanded()) commerce.applyRow();
    return !commerce?.expanded() && !commerce?.store.hasDraft();
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.hasUnsavedChanges() || this.commerceDraft() || this.commerceBusy())
      event.preventDefault();
  }

  error(control: AbstractControl | undefined): string {
    return validationMessage(control);
  }

  dateValue(value: unknown): Date | null {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  setDateValue(control: FormControl, value: Date | null): void {
    const formatted = value
      ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
      : null;
    this.setFieldValue(control, formatted);
  }

  setFieldValue(control: AbstractControl, value: string | number | boolean | null): void {
    if (this.fieldDisabled(control)) return;
    control.setValue(value);
    control.markAsDirty();
    this.form.markAsDirty();
  }

  fieldDisabled(control: AbstractControl): boolean {
    return control.disabled || this.commerceBusy() || this.mediaBusy() || this.store.busy();
  }

  choiceOptions(field: {
    choices: readonly { id: string; label: string; isActive: boolean }[];
  }): { label: string; value: string; disabled: boolean }[] {
    return field.choices.map((choice) => ({
      label: choice.label,
      value: choice.id,
      disabled: !choice.isActive,
    }));
  }
}
