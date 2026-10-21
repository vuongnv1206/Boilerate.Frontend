import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { ProductFulfillmentKind } from '@enums/product.enum';
import {
  createOptionForm,
  createOptionValueForm,
  createVariantForm,
  CreateSkuForm,
  generateSkuRows,
  optionInputs,
} from '@forms/product-commerce.form';
import { ProductForm } from '@forms/product-form.model';
import { ProductDto } from '@models/product.dto';
import { ProductCommerceStore } from '@stores/product-commerce.store';
import { ProductIoStore } from '@stores/product-io.store';
import { validationMessage } from '@shared/forms/validation-message';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog.component';
import { LeaveConfirmation } from '@shared/ui/confirm-dialog/leave-confirmation';
import { FieldMessage } from '@shared/ui/field-message/field-message.component';
import { MediaPreviewStore } from '@stores/media-preview.store';

/** One catalog draft; inventory and secret operations retain their own explicit actions. */
@Component({
  selector: 'app-product-commerce',
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    DatePipe,
    InputText,
    Textarea,
    FieldMessage,
    ConfirmDialog,
  ],
  providers: [ProductCommerceStore, LeaveConfirmation, MediaPreviewStore],
  templateUrl: './product-commerce.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCommerce implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  readonly product = input<ProductDto | null>(null);
  readonly form = input.required<ProductForm>();
  readonly catalog = input.required<ProductIoStore>();
  readonly blocked = input(false);
  readonly changed = output<ProductDto>();
  readonly busyChange = output<boolean>();
  readonly draftChange = output<boolean>();
  readonly store = inject(ProductCommerceStore);
  readonly confirmation = inject(LeaveConfirmation);
  readonly kind = ProductFulfillmentKind;
  readonly expanded = signal<CreateSkuForm | null>(null);
  readonly rowForm = createVariantForm();
  readonly localError = signal('');
  readonly previews = inject(MediaPreviewStore);
  readonly options = computed(() => this.form().controls.options.controls);
  readonly stockLabels: Readonly<Record<number, string>> = {
    1: 'Sẵn sàng',
    2: 'Ngừng cung cấp',
    3: 'Đã giữ cho đơn',
    4: 'Đã giao',
  };
  constructor() {
    this.store.connect((product) => this.changed.emit(product));
    effect(() => {
      const product = this.product(),
        blocked = this.blocked();
      untracked(() => {
        if (product) this.store.sync(product, blocked);
        this.expanded.set(null);
      });
    });
    effect(() => this.busyChange.emit(this.store.busy() || !!this.store.pendingAdjustment()));
    effect(() => this.draftChange.emit(this.store.hasDraft() || !!this.expanded()));
    effect(() => {
      const product = this.product();
      untracked(() => this.previews.load(product?.media.map((media) => media.mediaAssetId) ?? []));
    });
  }
  ngOnInit(): void {
    this.form()
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() =>
        this.previews.load(
          this.form()
            .controls.media.getRawValue()
            .map((media) => media.mediaAssetId),
        ),
      );
  }
  error(control: AbstractControl | undefined): string {
    return validationMessage(control);
  }
  markDirty(): void {
    this.form().markAsDirty();
    this.form().updateValueAndValidity();
  }
  addOption(): void {
    if (!this.catalog().isNew() || !this.catalog().canWrite() || this.options().length >= 3) return;
    this.form().controls.options.push(createOptionForm());
    this.markDirty();
  }
  removeOption(index: number): void {
    if (!this.catalog().isNew() || !this.catalog().canWrite()) return;
    this.form().controls.options.removeAt(index);
    this.form().controls.variants.clear();
    this.markDirty();
  }
  addValue(index: number): void {
    if (!this.catalog().canWrite()) return;
    this.options()[index]?.controls.values.push(createOptionValueForm());
    this.markDirty();
  }
  removeValue(optionIndex: number, valueIndex: number): void {
    const option = this.options()[optionIndex],
      value = option?.controls.values.at(valueIndex);
    if (
      !this.catalog().canWrite() ||
      !option ||
      !value ||
      value.controls.id.value ||
      option.controls.values.length <= 1
    )
      return;
    option.controls.values.removeAt(valueIndex);
    this.markDirty();
  }
  generate(): void {
    if (!this.catalog().canWrite()) return;
    this.form().controls.options.markAllAsTouched();
    if (this.form().controls.options.invalid) {
      this.localError.set('Kiểm tra tên và giá trị lựa chọn.');
      return;
    }
    try {
      const current = this.form().controls.variants.controls;
      const prefix =
        this.form().controls.sku.value ||
        this.product()?.variants.find((v) => v.isDefault)?.sku ||
        'SKU';
      const rows = generateSkuRows(
        optionInputs(this.options()),
        prefix,
        this.catalog().canPrice() ? this.form().controls.price.value : null,
        current,
      );
      this.form().controls.variants.clear({ emitEvent: false });
      rows.forEach((row) => this.form().controls.variants.push(row, { emitEvent: false }));
      if (!this.form().controls.defaultVariantSku.value)
        this.form().controls.defaultVariantSku.setValue(rows[0]?.controls.sku.value ?? '');
      this.localError.set('');
      this.markDirty();
    } catch (error: unknown) {
      this.localError.set(error instanceof Error ? error.message : 'Không tạo được SKU.');
    }
  }
  valueLabel(row: CreateSkuForm, optionIndex: number): string {
    const option = this.options()[optionIndex]?.getRawValue();
    return (
      option?.values.find(
        (v) =>
          v.code.trim().toUpperCase() ===
          row.controls.options.value[option.code.trim().toUpperCase()],
      )?.label || '—'
    );
  }
  async expand(row: CreateSkuForm): Promise<void> {
    if (this.store.busy() || this.store.hasDraft()) return;
    if (this.expanded() && this.rowForm.dirty && !(await this.confirmation.request(true, false)))
      return;
    this.rowForm.reset({ ...row.getRawValue(), selections: {} }, { emitEvent: false });
    if (this.catalog().canWrite()) this.rowForm.enable({ emitEvent: false });
    else this.rowForm.disable({ emitEvent: false });
    if (row.controls.id.value || !this.catalog().canWrite())
      this.rowForm.controls.sku.disable({ emitEvent: false });
    else this.rowForm.controls.sku.enable({ emitEvent: false });
    for (const control of [this.rowForm.controls.price, this.rowForm.controls.compareAtPrice]) {
      if (this.catalog().canPrice() && this.catalog().canWrite())
        control.enable({ emitEvent: false });
      else control.disable({ emitEvent: false });
    }
    this.expanded.set(row);
    this.localError.set('');
  }
  applyRow(): void {
    const row = this.expanded();
    if (!row || !this.catalog().canWrite()) return;
    this.rowForm.markAllAsTouched();
    if (this.rowForm.invalid) return;
    const raw = this.rowForm.getRawValue();
    const defaultSku = this.form().controls.defaultVariantSku.value;
    if (!raw.isActive && defaultSku === row.controls.sku.value) {
      this.localError.set('Chọn SKU mặc định khác trước khi ngừng SKU này.');
      return;
    }
    if (
      this.form().controls.variants.controls.some(
        (other) =>
          other !== row && other.controls.sku.value.toUpperCase() === raw.sku.trim().toUpperCase(),
      )
    ) {
      this.localError.set('Mã SKU đã được sử dụng.');
      return;
    }
    const previousSku = row.controls.sku.value;
    row.patchValue({
      sku: raw.sku.trim(),
      price: raw.price,
      compareAtPrice: raw.compareAtPrice,
      isActive: raw.isActive,
      imageMediaId: raw.imageMediaId,
    });
    if (defaultSku === previousSku || !defaultSku)
      this.form().controls.defaultVariantSku.setValue(raw.sku.trim());
    this.expanded.set(null);
    this.localError.set('');
    this.markDirty();
  }
  async cancelRow(): Promise<void> {
    if (await this.confirmation.request(this.rowForm.dirty, false)) {
      this.expanded.set(null);
      this.localError.set('');
    }
  }
  setDefault(row: CreateSkuForm): void {
    if (!this.catalog().canWrite() || !row.controls.isActive.value) return;
    this.form().controls.defaultVariantSku.setValue(row.controls.sku.value);
    this.markDirty();
  }
  removeRow(index: number): void {
    const row = this.form().controls.variants.at(index);
    if (!row || row.controls.id.value || !this.catalog().canWrite()) return;
    this.form().controls.variants.removeAt(index);
    this.markDirty();
  }
  openStock(row: CreateSkuForm): void {
    const variant = this.product()?.variants.find(
      (variant) => variant.id === row.controls.id.value,
    );
    if (!variant || this.blocked() || this.expanded()) return;
    if (this.product()?.fulfillmentKind === this.kind.Physical) {
      const balance = this.store.balances().find((balance) => balance.variantId === variant.id);
      if (balance) this.store.openInventory(balance);
    } else this.store.openDigital(variant);
  }
  quantity(row: CreateSkuForm): string {
    const variant = this.product()?.variants.find(
      (variant) => variant.id === row.controls.id.value,
    );
    if (!variant) return 'Sau khi lưu';
    if (this.product()?.fulfillmentKind === this.kind.Physical) {
      if (!this.store.canInventory()) return 'Cần quyền xem tồn';
      const balances = this.store.balances().filter((balance) => balance.variantId === variant.id);
      return String(balances.reduce((total, balance) => total + balance.available, 0));
    }
    return variant.inStock ? 'Có sẵn' : 'Chưa có sẵn';
  }
  async close(): Promise<void> {
    const dirty =
      this.store.mode() === 'inventory'
        ? this.store.adjustmentForm.dirty
        : this.store.digitalForm.dirty;
    if (
      await this.confirmation.request(dirty, this.store.busy() || !!this.store.pendingAdjustment())
    )
      this.store.close();
  }
  resetDraft(): void {
    this.expanded.set(null);
    this.rowForm.markAsPristine();
    this.store.close();
  }
}
