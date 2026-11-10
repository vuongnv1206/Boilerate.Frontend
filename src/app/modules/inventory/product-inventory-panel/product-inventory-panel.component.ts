import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { Observable, Subscription, finalize, of, switchMap, take } from 'rxjs';
import { BaseComponent, LeaveConfirmation, PagedResult } from '@core/base';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { createOperationId } from '@core/http/operation-id';
import { validationMessage } from '@shared/forms/validation-message';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { SecretReveal } from '@shared/ui/secret-reveal/secret-reveal.component';
import {
  AdjustInventoryRequest,
  DIGITAL_STOCK_STATE_LABELS,
  DigitalAvailabilityDto,
  DigitalInventoryItemDto,
  InventoryBalanceDto,
  InventoryFulfillmentKind,
  InventoryPanelMode,
  InventoryProductContext,
  InventoryVariantSummary,
  MAX_STOCK_QUANTITY,
  StockMovementDto,
  createDigitalContentForm,
  createInventoryAdjustmentForm,
} from '@api/inventory/models/inventory.dto';
import { DigitalInventoryService } from '@api/inventory/services/digital-inventory.service';
import { InventoryService } from '@api/inventory/services/inventory.service';

@Component({
  selector: 'app-product-inventory-panel',
  providers: [LeaveConfirmation],
  imports: [SHARED_IMPORTS, SecretReveal],
  templateUrl: './product-inventory-panel.component.html',
})
export class ProductInventoryPanel extends BaseComponent {
  // System variables
  readonly product = input<InventoryProductContext | null>(null);
  readonly blocked = input(false);
  readonly refreshProduct = input<(() => Observable<unknown>) | null>(null);

  readonly balancesChange = output<readonly InventoryBalanceDto[]>();
  readonly busyChange = output<boolean>();

  protected readonly kind = InventoryFulfillmentKind;
  protected readonly stockLabels = DIGITAL_STOCK_STATE_LABELS;

  private syncedProductId: string | null = null;
  private generation = 0;
  private mutationSub?: Subscription;
  private stockReadSub?: Subscription;
  private detailReadSub?: Subscription;
  private availabilitySub?: Subscription;

  // Business variables
  readonly adjustmentForm = createInventoryAdjustmentForm();
  readonly digitalForm = createDigitalContentForm();

  readonly busy = signal(false);
  readonly inventoryLoading = signal(false);
  readonly panelError = signal('');
  readonly notice = signal('');
  readonly mode = signal<InventoryPanelMode>(null);
  readonly balances = signal<readonly InventoryBalanceDto[]>([]);
  readonly movements = signal<PagedResult<StockMovementDto> | null>(null);
  readonly digital = signal<PagedResult<DigitalInventoryItemDto> | null>(null);
  readonly availability = signal<DigitalAvailabilityDto | null>(null);
  readonly selectedVariant = signal<InventoryVariantSummary | null>(null);
  readonly selectedBalance = signal<InventoryBalanceDto | null>(null);
  readonly pendingAdjustment = signal<AdjustInventoryRequest | null>(null);
  readonly revealingId = signal<string | null>(null);
  readonly revealedEntryId = signal<string | null>(null);
  readonly revealedSecret = signal('');

  readonly canInventory = computed(() => this.can('Inventory', 'View'));
  readonly canAdjust = computed(() => this.can('Inventory', 'Adjust') && this.canInventory());
  readonly canDigital = computed(() => this.can('DigitalInventory', 'View'));
  readonly canImport = computed(() => this.can('DigitalInventory', 'Import') && this.canDigital());
  readonly canDigitalUpdate = computed(
    () => this.can('DigitalInventory', 'Update') && this.canDigital(),
  );
  readonly canReveal = computed(() => this.can('DigitalInventory', 'Reveal'));
  readonly hasDraft = computed(() => this.mode() !== null);

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly digitalService: DigitalInventoryService,
    protected readonly confirmation: LeaveConfirmation,
  ) {
    super();
    effect(() => {
      const current = this.product();
      untracked(() => this.syncProduct(current));
    });
    effect(() => {
      this.busyChange.emit(this.busy());
    });
    this.destroyRef.onDestroy(() => {
      this.generation += 1;
      this.mutationSub?.unsubscribe();
      this.stockReadSub?.unsubscribe();
      this.detailReadSub?.unsubscribe();
      this.availabilitySub?.unsubscribe();
      this.clearSecret();
    });
  }

  balanceForVariant(variantId: string): InventoryBalanceDto | null {
    if (!variantId) return null;
    return this.balances().find((balance) => balance.variantId === variantId) ?? null;
  }

  openPhysical(variant: InventoryVariantSummary): boolean {
    const balance = this.balanceForVariant(variant.id);
    if (!balance || !this.canInventory() || this.busy() || this.blocked() || this.hasDraft()) {
      return false;
    }
    this.selectedVariant.set(variant);
    this.selectedBalance.set(balance);
    this.adjustmentForm.enable({ emitEvent: false });
    this.adjustmentForm.reset({ delta: null, reason: '' });
    this.pendingAdjustment.set(null);
    this.movements.set(null);
    this.openMode('inventory');
    this.loadMovements(1);
    return true;
  }

  openDigital(variant: InventoryVariantSummary): boolean {
    if (!this.canDigital() || this.busy() || this.blocked() || this.hasDraft()) {
      return false;
    }
    this.selectedVariant.set(variant);
    this.digital.set(null);
    this.availability.set(null);
    this.digitalForm.enable({ emitEvent: false });
    this.digitalForm.reset({ reference: '', content: '', isActive: true });
    if (this.product()?.fulfillmentKind === InventoryFulfillmentKind.DigitalShared) {
      this.digitalForm.controls.reference.disable({ emitEvent: false });
    }
    this.openMode('digital');
    this.loadDigital(1);
    return true;
  }

  loadInventory(): void {
    const current = this.product();
    if (
      !current ||
      current.fulfillmentKind !== InventoryFulfillmentKind.Physical ||
      !this.canInventory()
    ) {
      return;
    }
    this.stockReadSub?.unsubscribe();
    const generation = this.generation;
    this.inventoryLoading.set(true);
    this.stockReadSub = this.inventoryService
      .getAllProductBalances(current.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          if (generation !== this.generation) return;
          this.balances.set(rows);
          this.balancesChange.emit(rows);
          const selected = this.selectedBalance();
          if (selected) {
            this.selectedBalance.set(rows.find((row) => row.id === selected.id) ?? null);
          }
          this.inventoryLoading.set(false);
        },
        error: (rawError: unknown) => {
          if (generation !== this.generation) return;
          this.inventoryLoading.set(false);
          this.fail(rawError, 'Không tải được tồn kho.');
        },
      });
  }

  loadMovements(page = 1): void {
    const balance = this.selectedBalance();
    if (!balance || !this.canInventory()) return;
    this.detailReadSub?.unsubscribe();
    const generation = this.generation;
    this.detailReadSub = this.inventoryService
      .getMovements(balance.id, page)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ledger) => {
          if (generation === this.generation) {
            this.movements.set(ledger);
          }
        },
        error: (rawError: unknown) => {
          if (generation === this.generation) {
            this.fail(rawError, 'Không tải được lịch sử tồn kho.');
          }
        },
      });
  }

  adjust(): void {
    const current = this.product();
    const balance = this.selectedBalance();
    if (
      !current ||
      !balance ||
      !this.canAdjust() ||
      this.busy() ||
      this.blocked() ||
      this.mode() !== 'inventory'
    ) {
      return;
    }
    let request = this.pendingAdjustment();
    if (!request) {
      this.adjustmentForm.markAllAsTouched();
      if (this.adjustmentForm.invalid) return;
      const raw = this.adjustmentForm.getRawValue();
      if (raw.delta === null) return;
      const next = balance.onHand + raw.delta;
      if (next < balance.reserved || next > MAX_STOCK_QUANTITY) {
        this.panelError.set('Tồn sau điều chỉnh phải từ số đã giữ đến 2.147.483.647.');
        return;
      }
      request = {
        inventoryItemId: balance.id,
        version: balance.version,
        operationId: createOperationId(),
        delta: raw.delta,
        reason: raw.reason.trim(),
      };
      this.pendingAdjustment.set(request);
      this.adjustmentForm.disable({ emitEvent: false });
    }
    const generation = this.generation;
    const refreshFn = this.refreshProduct();
    this.beginWrite();
    this.mutationSub = this.inventoryService
      .adjustStock(request.inventoryItemId, request)
      .pipe(
        switchMap(() => (refreshFn ? refreshFn() : of(null))),
        take(1),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (generation === this.generation) {
            this.busy.set(false);
          }
        }),
      )
      .subscribe({
        next: () => {
          if (generation !== this.generation) return;
          this.pendingAdjustment.set(null);
          this.adjustmentForm.enable({ emitEvent: false });
          this.adjustmentForm.reset({ delta: null, reason: '' });
          this.notice.set('Đã ghi nhận điều chỉnh tồn kho.');
          this.loadInventory();
          this.loadMovements(1);
        },
        error: (rawError: unknown) => {
          if (generation !== this.generation) return;
          const apiError = normalizeApiError(rawError);
          if ([400, 401, 403, 404, 409, 422].includes(apiError.status)) {
            this.pendingAdjustment.set(null);
            this.adjustmentForm.enable({ emitEvent: false });
          }
          this.fail(
            apiError,
            this.pendingAdjustment()
              ? 'Chưa xác nhận kết quả. Gửi lại đúng yêu cầu cũ để đối chiếu; không nhập thao tác trùng.'
              : 'Không thể điều chỉnh tồn kho.',
          );
        },
      });
  }

  loadDigital(page = 1): void {
    const variant = this.selectedVariant();
    if (!variant || !this.canDigital()) return;
    this.detailReadSub?.unsubscribe();
    this.availabilitySub?.unsubscribe();
    const generation = this.generation;
    this.detailReadSub = this.digitalService
      .getItems(variant.id, page)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          if (generation === this.generation) {
            this.digital.set(rows);
            this.availability.set({
              variantId: variant.id,
              total: rows.total,
              availableCount: rows.items.filter((item) => item.state === 1).length,
              disabledCount: rows.items.filter((item) => item.state === 2).length,
              reservedCount: rows.items.filter((item) => item.state === 3).length,
              deliveredCount: rows.items.filter((item) => item.state === 4).length,
            });
          }
        },
        error: (rawError: unknown) => {
          if (generation === this.generation) {
            this.fail(rawError, 'Không tải được tồn số.');
          }
        },
      });
  }

  saveDigital(): void {
    const current = this.product();
    const variant = this.selectedVariant();
    if (!current || !variant || this.busy() || this.blocked() || this.mode() !== 'digital') {
      return;
    }
    const shared = current.fulfillmentKind === InventoryFulfillmentKind.DigitalShared;
    if (shared ? !this.canDigitalUpdate() : !this.canImport()) return;
    this.digitalForm.markAllAsTouched();
    if (this.digitalForm.invalid) return;
    const raw = this.digitalForm.getRawValue();
    const write$: Observable<unknown> = shared
      ? this.digitalService.updateDeliverySpec(variant.id, {
          productId: current.id,
          variantId: variant.id,
          version: current.version,
          content: raw.content,
          isActive: raw.isActive,
        })
      : this.digitalService.importBatch(variant.id, {
          productId: current.id,
          variantId: variant.id,
          version: current.version,
          items: [{ reference: raw.reference.trim(), content: raw.content }],
        });
    this.runDigitalMutation(write$);
  }

  setDigitalAvailability(stock: DigitalInventoryItemDto): void {
    const current = this.product();
    if (!current || !this.canDigitalUpdate() || this.busy() || this.blocked() || stock.state > 2) {
      return;
    }
    this.runDigitalMutation(
      this.digitalService.setItemAvailability(stock.variantId, stock.id, {
        productId: current.id,
        variantId: stock.variantId,
        stockItemId: stock.id,
        version: current.version,
        isAvailable: stock.state !== 1,
      }),
    );
  }

  reveal(stock: DigitalInventoryItemDto): void {
    if (!this.canReveal() || this.busy() || this.mode() !== 'digital') return;
    this.clearSecret();
    this.revealingId.set(stock.id);
    const generation = this.generation;
    this.detailReadSub?.unsubscribe();
    this.detailReadSub = this.digitalService
      .revealSecret(stock.id)
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (this.revealingId() === stock.id) {
            this.revealingId.set(null);
          }
        }),
      )
      .subscribe({
        next: (result) => {
          if (generation === this.generation && this.mode() === 'digital') {
            this.revealedEntryId.set(stock.id);
            this.revealedSecret.set(result.content);
          }
        },
        error: (rawError: unknown) => {
          if (generation === this.generation) {
            this.fail(rawError, 'Không đọc được nội dung số.');
          }
        },
      });
  }

  clearSecret(): void {
    this.revealingId.set(null);
    this.revealedEntryId.set(null);
    this.revealedSecret.set('');
  }

  async requestClose(): Promise<void> {
    const dirty = this.mode() === 'inventory' ? this.adjustmentForm.dirty : this.digitalForm.dirty;
    if (await this.confirmation.request(dirty, this.busy() || !!this.pendingAdjustment())) {
      this.close();
    }
  }

  close(): void {
    if (this.busy() || this.pendingAdjustment()) return;
    this.mode.set(null);
    this.clearSecret();
    this.detailReadSub?.unsubscribe();
    this.availabilitySub?.unsubscribe();
    this.panelError.set('');
  }

  resetDraft(): void {
    this.close();
  }

  reloadCanonical(): void {
    if (this.busy()) return;
    const refreshFn = this.refreshProduct();
    if (refreshFn) {
      const generation = this.generation;
      this.busy.set(true);
      refreshFn()
        .pipe(
          take(1),
          takeUntilDestroyed(this.destroyRef),
          finalize(() => {
            if (generation === this.generation) {
              this.busy.set(false);
            }
          }),
        )
        .subscribe({
          next: () => {
            if (generation !== this.generation) return;
            this.panelError.set('');
          },
          error: (rawError: unknown) => {
            if (generation === this.generation) {
              this.fail(rawError, 'Không tải được phiên bản mới.');
            }
          },
        });
    }
    this.loadInventory();
    if (this.mode() === 'inventory') this.loadMovements(1);
    if (this.mode() === 'digital') this.loadDigital(1);
  }

  protected error(control: AbstractControl | null): string {
    return validationMessage(control);
  }

  private syncProduct(current: InventoryProductContext | null): void {
    if (!current) {
      this.syncedProductId = null;
      this.generation += 1;
      this.mutationSub?.unsubscribe();
      this.stockReadSub?.unsubscribe();
      this.detailReadSub?.unsubscribe();
      this.availabilitySub?.unsubscribe();
      this.mode.set(null);
      this.pendingAdjustment.set(null);
      this.balances.set([]);
      this.balancesChange.emit([]);
      this.clearSecret();
      return;
    }
    if (this.syncedProductId !== current.id) {
      this.syncedProductId = current.id;
      this.generation += 1;
      this.mutationSub?.unsubscribe();
      this.stockReadSub?.unsubscribe();
      this.detailReadSub?.unsubscribe();
      this.availabilitySub?.unsubscribe();
      this.mode.set(null);
      this.pendingAdjustment.set(null);
      this.balances.set([]);
      this.balancesChange.emit([]);
      this.clearSecret();
      this.loadInventory();
    } else {
      const currentVariant = this.selectedVariant();
      if (currentVariant) {
        const updatedVariant =
          current.variants.find((variant) => variant.id === currentVariant.id) ?? null;
        if (updatedVariant) {
          this.selectedVariant.set(updatedVariant);
        }
      }
    }
  }

  private openMode(nextMode: 'inventory' | 'digital'): void {
    this.mode.set(nextMode);
    this.panelError.set('');
    this.notice.set('');
    this.clearSecret();
  }

  private beginWrite(): void {
    this.busy.set(true);
    this.panelError.set('');
    this.notice.set('');
  }

  private runDigitalMutation(write$: Observable<unknown>): void {
    if (this.busy()) return;
    const generation = this.generation;
    const refreshFn = this.refreshProduct();
    this.beginWrite();
    this.mutationSub = write$
      .pipe(
        switchMap(() => (refreshFn ? refreshFn() : of(null))),
        take(1),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (generation === this.generation) {
            this.busy.set(false);
          }
        }),
      )
      .subscribe({
        next: () => {
          if (generation !== this.generation) return;
          this.notice.set('Đã lưu thay đổi SKU và tồn.');
          this.mode.set(null);
          this.clearSecret();
          this.loadInventory();
        },
        error: (rawError: unknown) => {
          if (generation === this.generation) {
            this.fail(rawError, 'Không thể lưu. Nội dung đang nhập được giữ lại.');
          }
        },
      });
  }

  private fail(rawError: unknown, fallback: string): void {
    const apiError = normalizeApiError(rawError);
    if (apiError.status === 409) {
      this.panelError.set(
        'Dữ liệu đã thay đổi. Tải phiên bản mới để đối chiếu; nội dung đang nhập vẫn được giữ.',
      );
      return;
    }
    this.panelError.set(apiError.status > 0 ? apiError.message : fallback);
  }
}
