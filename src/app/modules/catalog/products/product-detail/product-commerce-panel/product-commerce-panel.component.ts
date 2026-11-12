import {
  Component,
  OnInit,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { BaseComponent } from '@core/base/base.component';
import { ProductInventoryPanel } from '@modules/inventory/product-inventory-panel/product-inventory-panel.component';
import { InventoryBalanceDto, InventoryProductContext } from '@api/inventory/models/inventory.dto';
import { validationMessage } from '@shared/forms/validation-message';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  CreateOptionForm,
  CreateSkuForm,
  PRODUCT_OPTION_LIMIT,
  PRODUCT_VARIANT_LIMIT,
  ProductDto,
  ProductForm,
  ProductFulfillmentKind,
  ProductMediaDto,
  VariantRowSnapshot,
  createOptionForm,
  createOptionValueForm,
  createProductMediaForm,
  createSkuRow,
  generatedCatalogCode,
} from '@api/catalog/models/product.dto';
import { MediaService } from '@api/catalog/services/media.service';
import { ProductMedia } from '../product-media/product-media.component';

@Component({
  selector: 'app-product-commerce-panel',
  imports: [SHARED_IMPORTS, ProductMedia, ProductInventoryPanel],
  templateUrl: './product-commerce-panel.component.html',
})
export class ProductCommercePanel extends BaseComponent implements OnInit {
  // System variables
  private readonly previewOwner = Symbol('product-commerce-panel');
  private readonly inventoryPanel = viewChild(ProductInventoryPanel);
  protected readonly kind = ProductFulfillmentKind;
  protected readonly optionLimit = PRODUCT_OPTION_LIMIT;
  protected readonly variantLimit = PRODUCT_VARIANT_LIMIT;
  private lastProductKey: string | null | undefined;
  private rowBaseline: VariantRowSnapshot | null = null;
  private baselineDefault = '';

  // Business variables
  readonly product = input<ProductDto | null>(null);
  readonly form = input.required<ProductForm>();
  readonly canWrite = input(false);
  readonly canPrice = input(false);
  readonly catalogBusy = input(false);
  readonly blocked = input(false);
  readonly refreshProduct = input<(() => Observable<unknown>) | null>(null);

  readonly busyChange = output<boolean>();
  readonly draftChange = output<boolean>();

  readonly expanded = signal<CreateSkuForm | null>(null);
  readonly editingOption = signal<number | null>(null);
  readonly pendingOptionRemoval = signal<number | null>(null);
  readonly valueText = signal('');
  readonly valueMenu = signal<number | null>(null);
  readonly renamingValue = signal<number | null>(null);
  readonly localError = signal('');
  readonly mediaUploading = signal(false);
  readonly inventoryBalances = signal<readonly InventoryBalanceDto[]>([]);
  readonly inventoryBusy = signal(false);

  optionDraft: CreateOptionForm = createOptionForm();

  readonly canInventory = computed(() => this.can('Inventory', 'View'));
  readonly canAdjust = computed(() => this.can('Inventory', 'Adjust') && this.canInventory());
  readonly canDigital = computed(() => this.can('DigitalInventory', 'View'));
  readonly inventoryContext = computed<InventoryProductContext | null>(() => {
    const current = this.product();
    if (!current) return null;
    return {
      id: current.id,
      version: current.version,
      fulfillmentKind: current.fulfillmentKind,
      variants: current.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        inStock: variant.inStock,
        isActive: variant.isActive,
        isDefault: variant.isDefault,
      })),
    };
  });

  constructor(protected readonly previews: MediaService) {
    super();
    effect(() => {
      const current = this.product();
      untracked(() => {
        const key = current ? `${current.id}:${current.version}` : null;
        if (key !== this.lastProductKey) {
          this.lastProductKey = key;
          this.expanded.set(null);
          this.cancelOption();
        }
      });
    });
    effect(() => {
      const panel = this.inventoryPanel();
      const pending = Boolean(panel?.pendingAdjustment());
      this.busyChange.emit(this.inventoryBusy() || pending || this.mediaUploading());
    });
    effect(() => {
      const panel = this.inventoryPanel();
      const hasPanelDraft = Boolean(panel?.hasDraft());
      this.draftChange.emit(hasPanelDraft || this.editingOption() !== null);
    });
    effect(() => {
      const current = this.product();
      untracked(() =>
        this.previews.retainPreviews(
          this.previewOwner,
          current?.media.map((media) => media.mediaAssetId) ?? [],
        ),
      );
    });
    this.destroyRef.onDestroy(() => {
      this.previews.releasePreviews(this.previewOwner);
    });
  }

  ngOnInit(): void {
    this.form()
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.previews.retainPreviews(
          this.previewOwner,
          this.form()
            .controls.media.getRawValue()
            .map((media) => media.mediaAssetId),
        );
      });
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
    if (!this.canWrite() || this.options().length >= this.optionLimit || !this.finishOption()) {
      return;
    }
    this.optionDraft = createOptionForm();
    this.editingOption.set(this.options().length);
    this.valueText.set('');
    this.localError.set('');
  }

  editOption(index: number): void {
    if (!this.canWrite() || this.editingOption() === index || !this.finishOption()) {
      return;
    }
    const source = this.options()[index];
    if (!source) return;
    this.optionDraft = this.cloneOption(source);
    this.editingOption.set(index);
    this.valueText.set('');
    this.localError.set('');
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
        (option, i) =>
          i !== index &&
          option.controls.name.value.trim().toLocaleLowerCase('vi') ===
            this.optionDraft.controls.name.value.trim().toLocaleLowerCase('vi'),
      )
    ) {
      this.localError.set('Tên nhóm lựa chọn đã có.');
      return false;
    }
    this.optionDraft.controls.name.setValue(this.optionDraft.controls.name.value.trim());
    if (index === this.options().length) {
      this.optionDraft.controls.code.setValue(
        generatedCatalogCode(
          this.optionDraft.controls.name.value,
          this.options().map((option) => option.controls.code.value),
          'OPTION',
        ),
        { emitEvent: false },
      );
    }
    if (index < this.options().length) {
      this.form().controls.options.setControl(index, this.optionDraft);
    } else {
      this.form().controls.options.push(this.optionDraft);
    }
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
        (value, i) =>
          i !== index &&
          value.controls.label.value.toLocaleLowerCase('vi') === text.toLocaleLowerCase('vi'),
      )
    ) {
      this.localError.set('Giá trị bị trùng hoặc dài quá 100 ký tự.');
      return false;
    }
    if (index !== null) {
      this.optionDraft.controls.values.at(index).controls.label.setValue(text);
    } else {
      this.optionDraft.controls.values.push(
        createOptionValueForm(
          generatedCatalogCode(
            text,
            this.optionDraft.controls.values.controls.map((value) => value.controls.code.value),
            'VALUE',
          ),
          text,
        ),
      );
    }
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
    if (event.key === 'Backspace' && !this.valueText() && this.renamingValue() === null) {
      this.removeChip(this.optionDraft.controls.values.length - 1);
    }
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

  removeCurrentOption(): void {
    const index = this.editingOption();
    if (index !== null) {
      this.removeOption(index);
    }
  }

  removeOption(index: number): void {
    if (!this.canWrite()) return;
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

  valueLabel(row: CreateSkuForm, index: number): string {
    const option = this.options()[index];
    return (
      option?.controls.values.controls.find(
        (value) =>
          value.controls.code.value === row.controls.options.value[option.controls.code.value],
      )?.controls.label.value || '—'
    );
  }

  variantName(row: CreateSkuForm): string {
    return this.options()
      .map((option, index) => `${option.controls.name.value}: ${this.valueLabel(row, index)}`)
      .join(', ');
  }

  expand(row: CreateSkuForm): void {
    const panel = this.inventoryPanel();
    if (
      this.inventoryBusy() ||
      Boolean(panel?.hasDraft()) ||
      !this.closeRow() ||
      !this.finishOption()
    ) {
      return;
    }
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

  revertRow(): void {
    const row = this.expanded();
    if (!row || !this.rowBaseline) return;
    row.patchValue(this.rowBaseline);
    this.form().controls.defaultVariantId.setValue(this.baselineDefault);
    this.localError.set('');
    this.markDirty();
  }

  setDefault(row: CreateSkuForm): void {
    if (!this.canWrite() || !row.controls.isActive.value) return;
    this.form().controls.defaultVariantId.setValue(this.rowKey(row));
    this.form().controls.defaultVariantSku.setValue(row.controls.sku.value);
    this.markDirty();
  }

  mainImage(row: CreateSkuForm): readonly ProductMediaDto[] {
    const id = row.controls.imageMediaId.value;
    if (!id) return [];
    const existing = this.form()
      .controls.media.getRawValue()
      .find((image) => image.mediaAssetId === id);
    return [existing ?? { mediaAssetId: id, sortOrder: 0, altText: null }];
  }

  imagesChanged(row: CreateSkuForm, images: readonly ProductMediaDto[], main = false): void {
    if (main) {
      row.controls.imageMediaId.setValue(images[0]?.mediaAssetId ?? null);
    } else {
      row.controls.images.setValue(images);
    }
    const all = [...this.form().controls.media.getRawValue()];
    for (const image of images) {
      if (main) {
        this.form()
          .controls.media.controls.find(
            (control) => control.controls.mediaAssetId.value === image.mediaAssetId,
          )
          ?.controls.altText.setValue(image.altText, { emitEvent: false });
      }
      if (!all.some((media) => media.mediaAssetId === image.mediaAssetId)) {
        all.push(image);
        this.form().controls.media.push(
          createProductMediaForm({ ...image, sortOrder: all.length - 1 }),
          { emitEvent: false },
        );
      }
    }
    this.markDirty();
  }

  setTrack(row: CreateSkuForm, checked: boolean): void {
    if (!this.canAdjust()) return;
    row.controls.trackInventory.setValue(checked);
    this.markDirty();
  }

  setVariantActive(row: CreateSkuForm, checked: boolean): void {
    if (!this.canWrite()) return;
    row.controls.isActive.setValue(checked);
    this.markDirty();
  }

  quantity(row: CreateSkuForm): string {
    if (this.form().controls.fulfillmentKind.value === this.kind.Physical) {
      if (!row.controls.trackInventory.value) return '∞';
      return row.controls.quantity.value === null ? '—' : String(row.controls.quantity.value);
    }
    if (this.form().controls.fulfillmentKind.value === this.kind.ManualExtension) return '∞';
    return this.product()?.variants.find((variant) => variant.id === row.controls.id.value)?.inStock
      ? 'Có sẵn'
      : '—';
  }

  inventoryBalance(row: CreateSkuForm): InventoryBalanceDto | null {
    const variantId = row.controls.id.value;
    if (!variantId) return null;
    return this.inventoryBalances().find((balance) => balance.variantId === variantId) ?? null;
  }

  openInventory(row: CreateSkuForm): void {
    const variant = this.product()?.variants.find((item) => item.id === row.controls.id.value);
    const balance = this.inventoryBalance(row);
    const panel = this.inventoryPanel();
    if (!variant || !balance || !panel || this.blocked()) {
      this.localError.set('Chưa có bản ghi tồn kho cho biến thể này.');
      return;
    }
    this.expanded.set(null);
    panel.openPhysical({
      id: variant.id,
      sku: variant.sku,
      inStock: variant.inStock,
      isActive: variant.isActive,
      isDefault: variant.isDefault,
    });
  }

  openStock(row: CreateSkuForm): void {
    const variant = this.product()?.variants.find((item) => item.id === row.controls.id.value);
    const panel = this.inventoryPanel();
    if (!variant || !panel || this.blocked()) {
      this.localError.set('Lưu sản phẩm trước khi quản lý nội dung số.');
      return;
    }
    this.expanded.set(null);
    panel.openDigital({
      id: variant.id,
      sku: variant.sku,
      inStock: variant.inStock,
      isActive: variant.isActive,
      isDefault: variant.isDefault,
    });
  }

  resetDraft(): void {
    this.expanded.set(null);
    this.cancelOption();
    this.pendingOptionRemoval.set(null);
    this.inventoryPanel()?.resetDraft();
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

  private regenerate(removingAxis = false): void {
    const rows = [...this.form().controls.variants.controls];
    const base = rows.find((row) => this.isDefault(row)) ?? rows[0];
    const baseline = base?.getRawValue();
    const options = this.options();
    let selections: Record<string, string>[] = [{}];
    for (const option of options) {
      selections = selections.flatMap((selection) =>
        option.controls.values.controls.map((value) => ({
          ...selection,
          [option.controls.code.value]: value.controls.code.value,
        })),
      );
    }
    const key = (selection: Readonly<Record<string, string>>) =>
      JSON.stringify(Object.entries(selection).sort(([a], [b]) => a.localeCompare(b)));
    if (!removingAxis) {
      for (const row of rows) {
        const selection = { ...row.controls.options.value };
        for (const option of options) {
          if (!(option.controls.code.value in selection)) {
            selection[option.controls.code.value] =
              option.controls.values.at(0).controls.code.value;
          }
        }
        row.controls.options.setValue(selection, { emitEvent: false });
      }
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
      const generatedSku = baseline?.sku.trim()
        ? [baseline.sku.trim(), ...Object.values(selection)].join('-').slice(0, 100)
        : '';
      const row = createSkuRow(generatedSku, selection, baseline?.price ?? 0);
      if (baseline) {
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
      }
      return row;
    });
    this.form().controls.variants.clear({ emitEvent: false });
    generated.forEach((row) => this.form().controls.variants.push(row, { emitEvent: false }));
    if (!generated.some((row) => this.isDefault(row))) {
      this.form().controls.defaultVariantId.setValue(
        generated[0] ? this.rowKey(generated[0]) : '',
        { emitEvent: false },
      );
    }
    this.expanded.set(null);
    this.markDirty();
  }
}
