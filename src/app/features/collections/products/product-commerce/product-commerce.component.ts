import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { ProductFulfillmentKind } from '@enums/product.enum';
import {
  createOptionForm,
  createOptionValueForm,
  createSkuRow,
  CreateOptionForm,
  CreateSkuForm,
  PRODUCT_OPTION_LIMIT,
  PRODUCT_VARIANT_LIMIT,
} from '@forms/product-commerce.form';
import { ProductForm } from '@forms/product-form.model';
import { createProductMediaForm } from '@forms/product.form';
import { ProductDto, ProductMedia } from '@models/product.dto';
import { ProductCommerceStore } from '@stores/product-commerce.store';
import { ProductIoStore } from '@stores/product-io.store';
import { validationMessage } from '@shared/forms/validation-message';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog.component';
import { LeaveConfirmation } from '@shared/ui/confirm-dialog/leave-confirmation';
import { FieldMessage } from '@shared/ui/field-message/field-message.component';
import { Icon } from '@shared/ui/icon/icon.component';
import { MediaPreviewStore } from '@stores/media-preview.store';
import { ProductMedia as ProductMediaEditor } from '../product-media/product-media.component';

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
    Icon,
    ProductMediaEditor,
    NgTemplateOutlet,
  ],
  providers: [ProductCommerceStore, LeaveConfirmation, MediaPreviewStore],
  templateUrl: './product-commerce.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCommerce implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private lastProductKey: string | null | undefined;
  readonly product = input<ProductDto | null>(null);
  readonly form = input.required<ProductForm>();
  readonly catalog = input.required<ProductIoStore>();
  readonly blocked = input(false);
  readonly changed = output<ProductDto>();
  readonly busyChange = output<boolean>();
  readonly draftChange = output<boolean>();
  readonly store = inject(ProductCommerceStore);
  readonly confirmation = inject(LeaveConfirmation);
  readonly previews = inject(MediaPreviewStore);
  readonly kind = ProductFulfillmentKind;
  readonly expanded = signal<CreateSkuForm | null>(null);
  readonly editingOption = signal<number | null>(null);
  readonly pendingOptionRemoval = signal<number | null>(null);
  readonly valueText = signal('');
  readonly valueMenu = signal<number | null>(null);
  readonly renamingValue = signal<number | null>(null);
  readonly localError = signal('');
  readonly mediaUploading = signal(false);
  optionDraft = createOptionForm();
  private rowBaseline: ReturnType<CreateSkuForm['getRawValue']> | null = null;
  private baselineDefault = '';
  readonly optionLimit = PRODUCT_OPTION_LIMIT;
  readonly variantLimit = PRODUCT_VARIANT_LIMIT;
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
        const key = product ? `${product.id}:${product.version}` : null;
        if (key !== this.lastProductKey) {
          this.lastProductKey = key;
          this.expanded.set(null);
          this.cancelOption();
        }
      });
    });
    effect(() =>
      this.busyChange.emit(
        this.store.busy() || !!this.store.pendingAdjustment() || this.mediaUploading(),
      ),
    );
    effect(() => this.draftChange.emit(this.store.hasDraft() || this.editingOption() !== null));
    effect(() => {
      const product = this.product();
      untracked(() => this.previews.load(product?.media.map((m) => m.mediaAssetId) ?? []));
    });
  }
  ngOnInit(): void {
    this.form()
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() =>
        this.previews.load(
          this.form()
            .controls.media.getRawValue()
            .map((m) => m.mediaAssetId),
        ),
      );
  }
  options(): readonly CreateOptionForm[] {
    return this.form().controls.options.controls;
  }
  error(control: AbstractControl | undefined): string {
    return validationMessage(control);
  }
  markDirty(): void {
    this.form().markAsDirty();
    this.form().updateValueAndValidity();
  }
  rowKey(row: CreateSkuForm): string {
    return row.controls.id.value || row.controls.clientId.value;
  }
  isDefault(row: CreateSkuForm): boolean {
    return this.form().controls.defaultVariantId.value === this.rowKey(row);
  }
  addOption(): void {
    if (
      !this.catalog().canWrite() ||
      this.options().length >= this.optionLimit ||
      !this.finishOption()
    )
      return;
    this.optionDraft = createOptionForm();
    this.editingOption.set(this.options().length);
    this.valueText.set('');
    this.localError.set('');
  }
  editOption(index: number): void {
    if (!this.catalog().canWrite() || this.editingOption() === index || !this.finishOption())
      return;
    const source = this.options()[index];
    if (!source) return;
    this.optionDraft = this.cloneOption(source);
    this.editingOption.set(index);
    this.valueText.set('');
    this.localError.set('');
  }
  private cloneOption(source: CreateOptionForm): CreateOptionForm {
    const raw = source.getRawValue();
    const clone = createOptionForm();
    clone.patchValue(raw, { emitEvent: false });
    clone.controls.values.clear();
    for (const value of raw.values) {
      const child = createOptionValueForm(value.code, value.label, value.id, value.sortOrder);
      child.controls.clientId.setValue(value.clientId);
      clone.controls.values.push(child);
    }
    return clone;
  }
  cancelOption(): void {
    this.editingOption.set(null);
    this.valueText.set('');
    this.renamingValue.set(null);
    this.valueMenu.set(null);
    this.localError.set('');
  }
  finishOption(): boolean {
    const index = this.editingOption();
    if (index === null) return true;
    if (this.valueText().trim() && !this.addChip()) return false;
    this.optionDraft.markAllAsTouched();
    if (this.optionDraft.invalid || !this.optionDraft.controls.values.length) {
      this.localError.set('Nhập tên nhóm và ít nhất một giá trị.');
      return false;
    }
    const count =
      this.options().reduce(
        (total, option, i) =>
          total *
          (i === index ? this.optionDraft.controls.values.length : option.controls.values.length),
        1,
      ) * (index === this.options().length ? this.optionDraft.controls.values.length : 1);
    if (count > this.variantLimit && count > this.form().controls.variants.length) {
      this.localError.set('Mỗi sản phẩm có tối đa 50 biến thể.');
      return false;
    }
    if (
      this.options().some(
        (o, i) =>
          i !== index &&
          o.controls.name.value.trim().toLocaleLowerCase('vi') ===
            this.optionDraft.controls.name.value.trim().toLocaleLowerCase('vi'),
      )
    ) {
      this.localError.set('Tên nhóm lựa chọn đã có.');
      return false;
    }
    this.optionDraft.controls.name.setValue(this.optionDraft.controls.name.value.trim());
    if (index < this.options().length)
      this.form().controls.options.setControl(index, this.optionDraft);
    else this.form().controls.options.push(this.optionDraft);
    this.cancelOption();
    this.regenerate();
    return true;
  }
  addChip(): boolean {
    const text = this.valueText().trim();
    if (!text) return true;
    const index = this.renamingValue();
    if (
      text.length > 100 ||
      this.optionDraft.controls.values.controls.some(
        (v, i) =>
          i !== index &&
          v.controls.label.value.toLocaleLowerCase('vi') === text.toLocaleLowerCase('vi'),
      )
    ) {
      this.localError.set('Giá trị bị trùng hoặc dài quá 100 ký tự.');
      return false;
    }
    if (index !== null) this.optionDraft.controls.values.at(index).controls.label.setValue(text);
    else this.optionDraft.controls.values.push(createOptionValueForm('', text));
    this.valueText.set('');
    this.renamingValue.set(null);
    this.valueMenu.set(null);
    this.localError.set('');
    return true;
  }
  chipKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === 'Tab') {
      if (this.valueText().trim()) {
        event.preventDefault();
        this.addChip();
      }
    }
    if (event.key === 'Backspace' && !this.valueText() && this.renamingValue() === null)
      this.removeChip(this.optionDraft.controls.values.length - 1);
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelOption();
    }
  }
  renameChip(index: number): void {
    const value = this.optionDraft.controls.values.at(index);
    if (!value) return;
    this.valueText.set(value.controls.label.value);
    this.renamingValue.set(index);
    this.valueMenu.set(null);
  }
  removeChip(index: number): void {
    if (index < 0) return;
    this.optionDraft.controls.values.removeAt(index);
    this.renamingValue.set(null);
    this.valueText.set('');
    this.valueMenu.set(null);
  }
  removeOption(index: number): void {
    if (!this.catalog().canWrite()) return;
    if (index === this.options().length) {
      this.cancelOption();
      return;
    }
    this.pendingOptionRemoval.set(index);
  }
  confirmRemoveOption(): void {
    const index = this.pendingOptionRemoval();
    if (index === null) return;
    this.form().controls.options.removeAt(index);
    this.pendingOptionRemoval.set(null);
    this.cancelOption();
    this.regenerate(true);
  }
  cancelRemoveOption(): void {
    this.pendingOptionRemoval.set(null);
  }
  optionSummary(index: number): string {
    const option = this.options()[index];
    return (
      option?.controls.values.controls.map((value) => value.controls.label.value).join(', ') || ''
    );
  }
  private regenerate(removingAxis = false): void {
    const rows = [...this.form().controls.variants.controls];
    const base = rows.find((row) => this.isDefault(row)) ?? rows[0];
    const baseline = base?.getRawValue();
    const options = this.options();
    let selections: Record<string, string>[] = [{}];
    for (const option of options)
      selections = selections.flatMap((selection) =>
        option.controls.values.controls.map((value) => ({
          ...selection,
          [option.controls.code.value]: value.controls.code.value,
        })),
      );
    const key = (selection: Readonly<Record<string, string>>) =>
      JSON.stringify(Object.entries(selection).sort(([a], [b]) => a.localeCompare(b)));
    if (!removingAxis)
      for (const row of rows) {
        const selection = { ...row.controls.options.value };
        for (const option of options)
          if (!(option.controls.code.value in selection))
            selection[option.controls.code.value] =
              option.controls.values.at(0).controls.code.value;
        row.controls.options.setValue(selection, { emitEvent: false });
      }
    const generated = selections.map((selection, index) => {
      const previous = removingAxis
        ? !options.length
          ? base
          : undefined
        : rows.find((row) => key(row.controls.options.value) === key(selection));
      if (previous) {
        previous.controls.options.setValue(selection, { emitEvent: false });
        return previous;
      }
      const row = createSkuRow(baseline?.sku ?? '', selection, baseline?.price ?? 0);
      if (baseline)
        row.patchValue(
          {
            compareAtPrice: baseline.compareAtPrice,
            imageMediaId: baseline.imageMediaId,
            images: baseline.images,
            trackInventory: baseline.trackInventory,
            quantity: removingAxis && index === 0 ? baseline.quantity : 0,
            weight: baseline.weight,
            width: baseline.width,
            height: baseline.height,
            length: baseline.length,
          },
          { emitEvent: false },
        );
      return row;
    });
    this.form().controls.variants.clear({ emitEvent: false });
    generated.forEach((row) => this.form().controls.variants.push(row, { emitEvent: false }));
    if (!generated.some((row) => this.isDefault(row)))
      this.form().controls.defaultVariantId.setValue(
        generated[0] ? this.rowKey(generated[0]) : '',
        { emitEvent: false },
      );
    this.expanded.set(null);
    this.markDirty();
  }
  valueLabel(row: CreateSkuForm, index: number): string {
    const option = this.options()[index];
    return (
      option?.controls.values.controls.find(
        (v) => v.controls.code.value === row.controls.options.value[option.controls.code.value],
      )?.controls.label.value || '—'
    );
  }
  variantName(row: CreateSkuForm): string {
    return this.options()
      .map((option, index) => `${option.controls.name.value}: ${this.valueLabel(row, index)}`)
      .join(', ');
  }
  expand(row: CreateSkuForm): void {
    if (this.store.busy() || this.store.hasDraft() || !this.closeRow() || !this.finishOption())
      return;
    this.rowBaseline = structuredClone(row.getRawValue());
    this.baselineDefault = this.form().controls.defaultVariantId.value;
    this.expanded.set(row);
    this.localError.set('');
  }
  rowKeydown(event: KeyboardEvent, row: CreateSkuForm): void {
    if (event.key !== ' ') return;
    event.preventDefault();
    this.expand(row);
  }
  closeRow(): boolean {
    const row = this.expanded();
    if (!row) return true;
    row.markAllAsTouched();
    if (row.invalid) {
      this.localError.set('Kiểm tra các trường của biến thể trước khi đóng.');
      return false;
    }
    this.expanded.set(null);
    this.localError.set('');
    return true;
  }
  applyRow(): void {
    this.closeRow();
  }
  revertRow(): void {
    const row = this.expanded();
    if (!row || !this.rowBaseline) return;
    row.patchValue(this.rowBaseline);
    this.form().controls.defaultVariantId.setValue(this.baselineDefault);
    this.localError.set('');
    this.markDirty();
  }
  setDefault(row: CreateSkuForm): void {
    if (!this.catalog().canWrite() || !row.controls.isActive.value) return;
    this.form().controls.defaultVariantId.setValue(this.rowKey(row));
    this.form().controls.defaultVariantSku.setValue(row.controls.sku.value);
    this.markDirty();
  }
  mainImage(row: CreateSkuForm): readonly ProductMedia[] {
    const id = row.controls.imageMediaId.value;
    return id
      ? [
          this.form()
            .controls.media.getRawValue()
            .find((image) => image.mediaAssetId === id) ?? {
            mediaAssetId: id,
            sortOrder: 0,
            altText: null,
          },
        ]
      : [];
  }
  imagesChanged(row: CreateSkuForm, images: readonly ProductMedia[], main = false): void {
    if (main) row.controls.imageMediaId.setValue(images[0]?.mediaAssetId ?? null);
    else row.controls.images.setValue(images);
    const all = [...this.form().controls.media.getRawValue()];
    for (const image of images) {
      if (main)
        this.form()
          .controls.media.controls.find(
            (control) => control.controls.mediaAssetId.value === image.mediaAssetId,
          )
          ?.controls.altText.setValue(image.altText, { emitEvent: false });
      if (!all.some((m) => m.mediaAssetId === image.mediaAssetId)) {
        all.push(image);
        this.form().controls.media.push(
          createProductMediaForm({ ...image, sortOrder: all.length - 1 }),
          { emitEvent: false },
        );
      }
    }
    this.markDirty();
  }
  toggleTrack(row: CreateSkuForm, event: Event): void {
    if (!this.store.canAdjust()) return;
    row.controls.trackInventory.setValue((event.target as HTMLInputElement).checked);
    this.markDirty();
  }
  quantity(row: CreateSkuForm): string {
    if (this.form().controls.fulfillmentKind.value === this.kind.Physical)
      return !row.controls.trackInventory.value
        ? '∞'
        : row.controls.quantity.value === null
          ? '—'
          : String(row.controls.quantity.value);
    if (this.form().controls.fulfillmentKind.value === this.kind.ManualExtension) return '∞';
    return this.product()?.variants.find((v) => v.id === row.controls.id.value)?.inStock
      ? 'Có sẵn'
      : '—';
  }
  openStock(row: CreateSkuForm): void {
    const variant = this.product()?.variants.find((v) => v.id === row.controls.id.value);
    if (!variant || this.blocked()) {
      this.localError.set('Lưu sản phẩm trước khi quản lý nội dung số.');
      return;
    }
    this.expanded.set(null);
    this.store.openDigital(variant);
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
    this.cancelOption();
    this.pendingOptionRemoval.set(null);
    this.store.close();
  }
}
