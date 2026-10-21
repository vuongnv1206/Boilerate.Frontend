import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { EMPTY, Observable, Subscription, expand, finalize, reduce, switchMap, take } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error';
import { ProductFulfillmentKind } from '@enums/product.enum';
import {
  catalogRequired,
  createDigitalContentForm,
  createInventoryAdjustmentForm,
  createOptionEditForm,
  createVariantForm,
} from '@forms/product-commerce.form';
import {
  AdjustInventory,
  CatalogPage,
  DigitalStock,
  InventoryBalance,
  InventoryMovement,
} from '@models/inventory.dto';
import { ProductDto, ProductOption, ProductVariant } from '@models/product.dto';
import { ProductsService } from '@services/products.service';

/** Independent SKU/stock editor. One draft and one explicit mutation at a time. */
@Injectable()
export class ProductCommerceStore {
  private readonly service = inject(ProductsService);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  private readonly itemState = signal<ProductDto | null>(null);
  private readonly busyState = signal(false);
  private readonly loadingState = signal(false);
  private readonly errorState = signal('');
  private readonly noticeState = signal('');
  private readonly modeState = signal<'variant' | 'option' | 'inventory' | 'digital' | null>(null);
  private readonly balancesState = signal<readonly InventoryBalance[]>([]);
  private readonly movementsState = signal<CatalogPage<InventoryMovement> | null>(null);
  private readonly digitalState = signal<CatalogPage<DigitalStock> | null>(null);
  private readonly secretState = signal('');
  private readonly selectedVariantState = signal<ProductVariant | null>(null);
  private readonly selectedBalanceState = signal<InventoryBalance | null>(null);
  private readonly selectedOptionState = signal<ProductOption | null>(null);
  private readonly pendingAdjustmentState = signal<AdjustInventory | null>(null);
  private readonly conflictState = signal(false);
  private blocked = false;
  private generation = 0;
  private mutation?: Subscription;
  private stockRead?: Subscription;
  private detailRead?: Subscription;
  readonly item = this.itemState.asReadonly();
  readonly busy = this.busyState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly notice = this.noticeState.asReadonly();
  readonly mode = this.modeState.asReadonly();
  readonly balances = this.balancesState.asReadonly();
  readonly movements = this.movementsState.asReadonly();
  readonly digital = this.digitalState.asReadonly();
  readonly secret = this.secretState.asReadonly();
  readonly selectedVariant = this.selectedVariantState.asReadonly();
  readonly selectedBalance = this.selectedBalanceState.asReadonly();
  readonly selectedOption = this.selectedOptionState.asReadonly();
  readonly pendingAdjustment = this.pendingAdjustmentState.asReadonly();
  readonly conflict = this.conflictState.asReadonly();
  readonly hasDraft = computed(() => this.mode() !== null);
  readonly canUpdate = computed(() => this.session.can('Product', 'Update'));
  readonly canPrice = computed(() => this.session.can('Price', 'Update'));
  readonly canInventory = computed(() => this.session.can('Inventory', 'View'));
  readonly canAdjust = computed(
    () => this.session.can('Inventory', 'Adjust') && this.canInventory(),
  );
  readonly canDigital = computed(() => this.session.can('DigitalInventory', 'View'));
  readonly canImport = computed(
    () => this.session.can('DigitalInventory', 'Import') && this.canDigital(),
  );
  readonly canDigitalUpdate = computed(
    () => this.session.can('DigitalInventory', 'Update') && this.canDigital(),
  );
  readonly canReveal = computed(() => this.session.can('DigitalInventory', 'Reveal'));
  readonly variantForm = createVariantForm();
  readonly optionForm = createOptionEditForm();
  readonly adjustmentForm = createInventoryAdjustmentForm();
  readonly digitalForm = createDigitalContentForm();
  private onChanged: ((product: ProductDto) => void) | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.generation++;
      this.mutation?.unsubscribe();
      this.stockRead?.unsubscribe();
      this.detailRead?.unsubscribe();
      this.secretState.set('');
    });
  }

  connect(onChanged: (product: ProductDto) => void): void {
    this.onChanged = onChanged;
  }

  sync(product: ProductDto, blocked: boolean): void {
    this.blocked = blocked;
    if (this.itemState()?.id !== product.id) {
      this.generation++;
      this.mutation?.unsubscribe();
      this.stockRead?.unsubscribe();
      this.detailRead?.unsubscribe();
      this.modeState.set(null);
      this.pendingAdjustmentState.set(null);
      this.balancesState.set([]);
      this.itemState.set(product);
      this.loadInventory();
    } else this.itemState.set(product);
  }

  openVariant(variant: ProductVariant | null): void {
    const product = this.item();
    if (!product || this.busy() || this.blocked || !this.canUpdate() || this.hasDraft()) return;
    if (!variant && !product.options.length) return;
    for (const key of Object.keys(this.variantForm.controls.selections.controls))
      this.variantForm.controls.selections.removeControl(key, { emitEvent: false });
    for (const option of product.options)
      this.variantForm.controls.selections.addControl(
        option.code,
        new FormControl('', { nonNullable: true, validators: Validators.required }),
        { emitEvent: false },
      );
    if (variant) this.variantForm.controls.selections.disable({ emitEvent: false });
    else this.variantForm.controls.selections.enable({ emitEvent: false });
    this.variantForm.reset(
      {
        sku: variant?.sku ?? '',
        price: variant?.price ?? null,
        compareAtPrice: variant?.compareAtPrice ?? null,
        isActive: variant?.isActive ?? true,
        imageMediaId: variant?.imageMediaId ?? null,
      },
      { emitEvent: false },
    );
    if (variant) this.variantForm.controls.sku.disable({ emitEvent: false });
    else this.variantForm.controls.sku.enable({ emitEvent: false });
    for (const control of [
      this.variantForm.controls.price,
      this.variantForm.controls.compareAtPrice,
    ]) {
      if (this.canPrice()) control.enable({ emitEvent: false });
      else control.disable({ emitEvent: false });
    }
    this.selectedVariantState.set(variant);
    this.openMode('variant');
  }

  saveVariant(): void {
    const product = this.item();
    if (!product || this.mode() !== 'variant' || !this.canUpdate() || this.blocked || this.busy())
      return;
    this.variantForm.markAllAsTouched();
    const variant = this.selectedVariant();
    // Existing immutable selections are not editable or required in the edit form.
    if (variant) this.variantForm.controls.selections.disable({ emitEvent: false });
    else this.variantForm.controls.selections.enable({ emitEvent: false });
    if (this.variantForm.invalid) return;
    const raw = this.variantForm.getRawValue();
    if (variant) {
      if (
        !this.canPrice() &&
        (raw.price !== variant.price || raw.compareAtPrice !== variant.compareAtPrice)
      )
        return;
      this.writeProduct(
        this.service.editVariant({
          productId: product.id,
          variantId: variant.id,
          version: product.version,
          price: raw.price,
          compareAtPrice: raw.compareAtPrice,
          isActive: raw.isActive,
          imageMediaId: raw.imageMediaId,
        }),
      );
    } else {
      if (
        product.options.some(
          (option) => !option.values.some((value) => value.code === raw.selections[option.code]),
        )
      ) {
        this.errorState.set('Chọn một giá trị của mỗi lựa chọn.');
        return;
      }
      const duplicate = product.variants.some((existing) =>
        product.options.every((option) =>
          existing.selections.some(
            (selection) =>
              selection.optionId === option.id &&
              option.values.some(
                (value) =>
                  value.id === selection.optionValueId &&
                  value.code === raw.selections[option.code],
              ),
          ),
        ),
      );
      if (duplicate) {
        this.errorState.set('Tổ hợp này đã có SKU, kể cả SKU ngừng sử dụng.');
        return;
      }
      this.writeProduct(
        this.service.addVariant({
          productId: product.id,
          version: product.version,
          variant: {
            sku: raw.sku.trim(),
            price: this.canPrice() ? raw.price : null,
            compareAtPrice: this.canPrice() ? raw.compareAtPrice : null,
            options: raw.selections,
          },
        }),
      );
    }
  }

  setDefault(variant: ProductVariant): void {
    const product = this.item();
    if (
      !product ||
      !this.canUpdate() ||
      this.blocked ||
      this.busy() ||
      this.hasDraft() ||
      !variant.isActive ||
      variant.isDefault
    )
      return;
    this.writeProduct(this.service.setDefaultVariant(product.id, variant.id, product.version));
  }

  openOption(option: ProductOption): void {
    if (!this.canUpdate() || this.blocked || this.busy() || this.hasDraft()) return;
    this.optionForm.controls.values.clear({ emitEvent: false });
    this.optionForm.controls.addValues.clear({ emitEvent: false });
    for (const value of option.values)
      this.optionForm.controls.values.push(
        new FormGroup({
          id: new FormControl(value.id, { nonNullable: true }),
          label: new FormControl(value.label, {
            nonNullable: true,
            validators: [catalogRequired, Validators.maxLength(100)],
          }),
          sortOrder: new FormControl(value.sortOrder, {
            nonNullable: true,
            validators: [Validators.min(0), Validators.pattern(/^\d+$/u)],
          }),
        }),
        { emitEvent: false },
      );
    this.optionForm.reset(
      {
        name: option.name,
        sortOrder: option.sortOrder,
        values: option.values.map((value) => ({
          id: value.id,
          label: value.label,
          sortOrder: value.sortOrder,
        })),
        addValues: [],
      },
      { emitEvent: false },
    );
    this.selectedOptionState.set(option);
    this.openMode('option');
  }

  saveOption(): void {
    const product = this.item(),
      option = this.selectedOption();
    if (
      !product ||
      !option ||
      this.mode() !== 'option' ||
      !this.canUpdate() ||
      this.blocked ||
      this.busy()
    )
      return;
    this.optionForm.markAllAsTouched();
    if (this.optionForm.invalid) return;
    const raw = this.optionForm.getRawValue();
    const codes = [
      ...option.values.map((value) => value.code.toUpperCase()),
      ...raw.addValues.map((value) => value.code.trim().toUpperCase()),
    ];
    if (new Set(codes).size !== codes.length) {
      this.errorState.set('Mã giá trị bị trùng.');
      return;
    }
    this.writeProduct(
      this.service.editOption({
        productId: product.id,
        optionId: option.id,
        version: product.version,
        name: raw.name.trim(),
        sortOrder: raw.sortOrder,
        values: raw.values.map((value) => ({ ...value, label: value.label.trim() })),
        addValues: raw.addValues.map((value) => ({
          code: value.code.trim(),
          label: value.label.trim(),
        })),
      }),
    );
  }

  loadInventory(): void {
    const product = this.item();
    if (
      !product ||
      product.fulfillmentKind !== ProductFulfillmentKind.Physical ||
      !this.canInventory()
    )
      return;
    this.stockRead?.unsubscribe();
    const generation = this.generation;
    this.loadingState.set(true);
    this.stockRead = this.service
      .inventory(product.id)
      .pipe(
        expand((page) =>
          page.pageNumber * page.pageSize < page.total
            ? this.service.inventory(product.id, page.pageNumber + 1)
            : EMPTY,
        ),
        reduce((rows: InventoryBalance[], page) => [...rows, ...page.items], []),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (balances) => {
          if (generation !== this.generation) return;
          this.balancesState.set(balances);
          const selected = this.selectedBalance();
          if (selected)
            this.selectedBalanceState.set(
              balances.find((balance) => balance.id === selected.id) ?? null,
            );
          this.loadingState.set(false);
        },
        error: (error: unknown) => {
          if (generation !== this.generation) return;
          this.loadingState.set(false);
          this.fail(error, 'Không tải được tồn kho.');
        },
      });
  }

  openInventory(balance: InventoryBalance): void {
    if (!this.canInventory() || this.busy() || this.blocked || this.hasDraft()) return;
    this.selectedBalanceState.set(balance);
    this.adjustmentForm.reset({ delta: null, reason: '' });
    this.pendingAdjustmentState.set(null);
    this.movementsState.set(null);
    this.openMode('inventory');
    this.loadMovements();
  }

  loadMovements(page = 1): void {
    const balance = this.selectedBalance();
    if (!balance || !this.canInventory()) return;
    this.detailRead?.unsubscribe();
    const generation = this.generation;
    this.detailRead = this.service
      .inventoryMovements(balance.id, page)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          if (generation === this.generation) this.movementsState.set(rows);
        },
        error: (error: unknown) => {
          if (generation === this.generation) this.fail(error, 'Không tải được lịch sử tồn kho.');
        },
      });
  }

  adjust(): void {
    const product = this.item();
    const balance = this.selectedBalance();
    if (
      !product ||
      !balance ||
      !this.canAdjust() ||
      this.busy() ||
      this.blocked ||
      this.mode() !== 'inventory'
    )
      return;
    let request = this.pendingAdjustment();
    if (!request) {
      this.adjustmentForm.markAllAsTouched();
      if (this.adjustmentForm.invalid) return;
      const raw = this.adjustmentForm.getRawValue();
      if (raw.delta === null) return;
      const next = balance.onHand + raw.delta;
      if (next < balance.reserved || next > 2147483647) {
        this.errorState.set('Tồn sau điều chỉnh phải từ số đã giữ đến 2.147.483.647.');
        return;
      }
      request = {
        inventoryItemId: balance.id,
        version: balance.version,
        operationId: crypto.randomUUID(),
        delta: raw.delta,
        reason: raw.reason.trim(),
      };
      this.pendingAdjustmentState.set(request);
      this.adjustmentForm.disable({ emitEvent: false });
    }
    const generation = this.generation;
    this.beginWrite();
    this.mutation = this.service
      .adjustInventory(request)
      .pipe(
        switchMap(() => this.service.get(product.id)),
        take(1),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (generation === this.generation) this.busyState.set(false);
        }),
      )
      .subscribe({
        next: (saved) => {
          if (generation !== this.generation) return;
          this.itemState.set(saved);
          this.onChanged?.(saved);
          this.pendingAdjustmentState.set(null);
          this.adjustmentForm.enable({ emitEvent: false });
          this.adjustmentForm.reset({ delta: null, reason: '' });
          this.noticeState.set('Đã ghi nhận điều chỉnh tồn kho.');
          this.loadInventory();
          this.loadMovements();
        },
        error: (error: unknown) => {
          if (generation !== this.generation) return;
          if (error instanceof ApiError && [400, 401, 403, 404, 409, 422].includes(error.status)) {
            this.pendingAdjustmentState.set(null);
            this.adjustmentForm.enable({ emitEvent: false });
          }
          this.fail(
            error,
            this.pendingAdjustment()
              ? 'Chưa xác nhận kết quả. Gửi lại đúng yêu cầu cũ để đối chiếu; không nhập thao tác trùng.'
              : 'Không thể điều chỉnh tồn kho.',
          );
        },
      });
  }

  openDigital(variant: ProductVariant): void {
    if (!this.canDigital() || this.busy() || this.blocked || this.hasDraft()) return;
    this.selectedVariantState.set(variant);
    this.digitalState.set(null);
    this.digitalForm.enable({ emitEvent: false });
    this.digitalForm.reset({ reference: '', content: '', isActive: true });
    if (this.item()?.fulfillmentKind === ProductFulfillmentKind.DigitalShared)
      this.digitalForm.controls.reference.disable({ emitEvent: false });
    this.openMode('digital');
    this.loadDigital();
  }

  loadDigital(page = 1): void {
    const variant = this.selectedVariant();
    if (!variant || !this.canDigital()) return;
    this.detailRead?.unsubscribe();
    const generation = this.generation;
    this.detailRead = this.service
      .digitalStock(variant.id, page)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          if (generation === this.generation) this.digitalState.set(rows);
        },
        error: (error: unknown) => {
          if (generation === this.generation) this.fail(error, 'Không tải được tồn số.');
        },
      });
  }

  saveDigital(): void {
    const product = this.item(),
      variant = this.selectedVariant();
    if (!product || !variant || this.busy() || this.blocked || this.mode() !== 'digital') return;
    const shared = product.fulfillmentKind === ProductFulfillmentKind.DigitalShared;
    if (shared ? !this.canDigitalUpdate() : !this.canImport()) return;
    this.digitalForm.markAllAsTouched();
    if (this.digitalForm.invalid) return;
    const raw = this.digitalForm.getRawValue();
    const request: Observable<unknown> = shared
      ? this.service.saveSharedDigital(
          product.id,
          variant.id,
          product.version,
          raw.content,
          raw.isActive,
        )
      : this.service.importDigital(product.id, variant.id, product.version, [
          { reference: raw.reference.trim(), content: raw.content },
        ]);
    this.writeProduct(request.pipe(switchMap(() => this.service.get(product.id))));
  }

  setDigitalAvailability(stock: DigitalStock): void {
    const product = this.item();
    if (!product || !this.canDigitalUpdate() || this.busy() || this.blocked || stock.state > 2)
      return;
    this.writeProduct(
      this.service
        .setDigitalAvailability(
          product.id,
          stock.variantId,
          stock.id,
          product.version,
          stock.state !== 1,
        )
        .pipe(switchMap(() => this.service.get(product.id))),
    );
  }

  reveal(stock: DigitalStock): void {
    if (!this.canReveal() || this.busy() || this.mode() !== 'digital') return;
    this.secretState.set('');
    const generation = this.generation;
    this.detailRead?.unsubscribe();
    this.detailRead = this.service
      .revealDigital(stock.id)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (generation === this.generation && this.mode() === 'digital')
            this.secretState.set(result.content);
        },
        error: (error: unknown) => {
          if (generation === this.generation) this.fail(error, 'Không đọc được nội dung số.');
        },
      });
  }

  close(): void {
    if (this.busy() || this.pendingAdjustment()) return;
    this.modeState.set(null);
    this.secretState.set('');
    this.detailRead?.unsubscribe();
    this.errorState.set('');
    this.conflictState.set(false);
  }

  reloadCanonical(): void {
    if (this.busy()) return;
    this.refreshProduct();
    this.loadInventory();
    if (this.mode() === 'inventory') this.loadMovements();
    if (this.mode() === 'digital') this.loadDigital();
  }

  describeVariant(variant: ProductVariant): string {
    const product = this.item();
    return (
      variant.selections
        .map((selection) => {
          const option = product?.options.find((value) => value.id === selection.optionId);
          return `${option?.name ?? ''}: ${option?.values.find((value) => value.id === selection.optionValueId)?.label ?? ''}`;
        })
        .join(' · ') || 'Không có lựa chọn'
    );
  }

  private refreshProduct(): void {
    const product = this.item();
    if (!product) return;
    const generation = this.generation;
    this.busyState.set(true);
    this.service
      .get(product.id)
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (generation === this.generation) this.busyState.set(false);
        }),
      )
      .subscribe({
        next: (saved) => {
          if (generation !== this.generation) return;
          this.itemState.set(saved);
          this.onChanged?.(saved);
          const selected = this.selectedVariant();
          if (this.mode() === 'variant' && selected) {
            const current = saved.variants.find((variant) => variant.id === selected.id);
            if (current) {
              this.selectedVariantState.set(current);
              if (!this.canPrice()) {
                this.variantForm.controls.price.setValue(current.price, { emitEvent: false });
                this.variantForm.controls.compareAtPrice.setValue(current.compareAtPrice, {
                  emitEvent: false,
                });
              }
            }
          }
          this.conflictState.set(false);
        },
        error: (error: unknown) => {
          if (generation === this.generation) this.fail(error, 'Không tải được phiên bản mới.');
        },
      });
  }

  private openMode(mode: 'variant' | 'option' | 'inventory' | 'digital'): void {
    this.modeState.set(mode);
    this.errorState.set('');
    this.noticeState.set('');
    this.secretState.set('');
    this.conflictState.set(false);
  }
  private beginWrite(): void {
    this.busyState.set(true);
    this.errorState.set('');
    this.noticeState.set('');
  }
  private writeProduct(request: Observable<ProductDto>): void {
    if (this.busy()) return;
    const generation = this.generation;
    this.beginWrite();
    this.mutation = request
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (generation === this.generation) this.busyState.set(false);
        }),
      )
      .subscribe({
        next: (saved) => {
          if (generation !== this.generation) return;
          this.itemState.set(saved);
          this.onChanged?.(saved);
          this.noticeState.set('Đã lưu thay đổi SKU và tồn.');
          this.modeState.set(null);
          this.secretState.set('');
          this.loadInventory();
        },
        error: (error: unknown) => {
          if (generation === this.generation)
            this.fail(error, 'Không thể lưu. Nội dung đang nhập được giữ lại.');
        },
      });
  }
  private fail(error: unknown, fallback: string): void {
    this.conflictState.set(error instanceof ApiError && error.status === 409);
    this.errorState.set(
      error instanceof ApiError
        ? error.status === 409
          ? 'Dữ liệu đã thay đổi. Tải phiên bản mới để đối chiếu; nội dung đang nhập vẫn được giữ.'
          : error.message
        : fallback,
    );
  }
}
