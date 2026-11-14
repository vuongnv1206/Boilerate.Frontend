import { Component, computed, signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { BaseComponent } from '@core/base/base.component';
import { PagedResult } from '@core/http/pagination';
import { validationMessage } from '@shared/forms/validation-message';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { SecretReveal } from '@shared/ui/secret-reveal/secret-reveal.component';
import {
  AdjustInventoryRequest,
  DIGITAL_STOCK_STATE_LABELS,
  DigitalAvailabilityDto,
  DigitalInventoryItemDto,
  INVENTORY_PAGE_SIZE,
  INVENTORY_STOCK_FILTER_OPTIONS,
  InventoryBalanceDto,
  InventoryStockLevelFilter,
  LOW_STOCK_THRESHOLD,
  MAX_STOCK_QUANTITY,
  StockMovementDto,
} from '@api/inventory/models/inventory.dto';
import {
  createInventoryAdjustmentForm,
  createWorkspaceDigitalImportForm,
  parseDigitalBatchLines,
} from '@api/inventory/models/inventory.util';
import { DigitalInventoryService } from '@api/inventory/services/digital-inventory.service';
import { InventoryService } from '@api/inventory/services/inventory.service';

@Component({
  selector: 'app-inventory-workspace',
  imports: [SHARED_IMPORTS, SecretReveal],
  templateUrl: './inventory-workspace.component.html',
})
export class InventoryWorkspace extends BaseComponent {
  // System variables
  protected readonly stockFilterOptions = INVENTORY_STOCK_FILTER_OPTIONS;
  protected readonly stockStateLabels = DIGITAL_STOCK_STATE_LABELS;
  protected readonly lowStockThreshold = LOW_STOCK_THRESHOLD;

  // Business variables
  readonly adjustmentForm = createInventoryAdjustmentForm();
  readonly digitalImportForm = createWorkspaceDigitalImportForm();

  readonly initializing = signal(false);
  readonly balancesLoading = signal(false);
  readonly balancesError = signal('');
  readonly balancesPage = signal<PagedResult<InventoryBalanceDto> | null>(null);
  readonly searchKeyword = signal('');
  readonly stockFilter = signal<InventoryStockLevelFilter>('all');

  readonly adjustDialogOpen = signal(false);
  readonly adjusting = signal(false);
  readonly adjustError = signal('');
  readonly activeBalance = signal<InventoryBalanceDto | null>(null);
  readonly pendingAdjustment = signal<AdjustInventoryRequest | null>(null);

  readonly movementsDrawerOpen = signal(false);
  readonly movementsLoading = signal(false);
  readonly movementsError = signal('');
  readonly movementsBalance = signal<InventoryBalanceDto | null>(null);
  readonly movementsPage = signal<PagedResult<StockMovementDto> | null>(null);

  readonly variantLookupInput = signal('');
  readonly activeVariantId = signal('');
  readonly digitalLoading = signal(false);
  readonly digitalWorking = signal(false);
  readonly digitalError = signal('');
  readonly digitalAvailability = signal<DigitalAvailabilityDto | null>(null);
  readonly digitalItemsPage = signal<PagedResult<DigitalInventoryItemDto> | null>(null);

  readonly importDialogOpen = signal(false);
  readonly importError = signal('');

  readonly revealingItemId = signal<string | null>(null);
  readonly revealedItemId = signal<string | null>(null);
  readonly revealedSecret = signal<string | null>(null);

  readonly canPhysicalView = computed(() => this.can('Inventory', 'View'));
  readonly canInitialize = computed(
    () => this.can('Inventory', 'Initialize') || this.can('Inventory', 'Update'),
  );
  readonly canAdjust = computed(() => this.can('Inventory', 'Adjust') && this.canPhysicalView());
  readonly canDigitalView = computed(() => this.can('DigitalInventory', 'View'));
  readonly canDigitalImport = computed(
    () => this.can('DigitalInventory', 'Import') && this.canDigitalView(),
  );
  readonly canDigitalUpdate = computed(
    () => this.can('DigitalInventory', 'Update') && this.canDigitalView(),
  );
  readonly canDigitalReveal = computed(() => this.can('DigitalInventory', 'Reveal'));

  readonly filteredBalances = computed(() => {
    const items = this.balancesPage()?.items ?? [];
    const keyword = this.searchKeyword().trim().toLowerCase();
    const filter = this.stockFilter();
    return items.filter((row) => {
      if (
        keyword &&
        !row.variantId.toLowerCase().includes(keyword) &&
        !row.locationId.toLowerCase().includes(keyword) &&
        !row.id.toLowerCase().includes(keyword)
      ) {
        return false;
      }
      if (filter === 'out') return row.available <= 0;
      if (filter === 'low') return row.available > 0 && row.available <= LOW_STOCK_THRESHOLD;
      return true;
    });
  });

  readonly loadedVariantOptions = computed(() =>
    (this.balancesPage()?.items ?? []).map((item) => ({
      label: `${item.variantId} (Bán được: ${item.available})`,
      value: item.variantId,
    })),
  );

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly digitalService: DigitalInventoryService,
  ) {
    super();
    this.destroyRef.onDestroy(() => this.hideSecret());
    if (this.canPhysicalView()) {
      this.loadBalances(1);
    }
  }

  initializeMainWarehouse(): void {
    if (!this.canInitialize() || this.initializing()) return;
    this.runIdempotent(
      'initialize-main-warehouse',
      { locationCode: 'MAIN' },
      (operationId) => this.inventoryService.initializeWarehouse(operationId),
      {
        busy: this.initializing,
        successMessage: 'Đã khởi tạo kho mặc định MAIN.',
        toastOnError: true,
        onSuccess: () => {
          if (this.canPhysicalView()) {
            this.loadBalances(this.balancesPage()?.page ?? 1);
          }
        },
      },
    );
  }

  loadBalances(page = 1): void {
    if (!this.canPhysicalView()) return;
    const rawKeyword = this.searchKeyword().trim();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
    this.balancesError.set('');
    this.run(
      this.inventoryService.getBalances({
        page,
        size: INVENTORY_PAGE_SIZE,
        variantId: uuidPattern.test(rawKeyword) ? rawKeyword : undefined,
      }),
      {
        busy: this.balancesLoading,
        onSuccess: (result) => this.balancesPage.set(result),
        onError: (apiError) => this.balancesError.set(apiError.message),
      },
    );
  }

  applyBalanceSearch(): void {
    this.loadBalances(1);
  }

  resetBalanceFilters(): void {
    this.searchKeyword.set('');
    this.stockFilter.set('all');
    this.loadBalances(1);
  }

  openAdjustDialog(balance: InventoryBalanceDto): void {
    if (!this.canAdjust() || this.adjusting()) return;
    this.activeBalance.set(balance);
    this.pendingAdjustment.set(null);
    this.adjustError.set('');
    this.adjustmentForm.enable({ emitEvent: false });
    this.adjustmentForm.reset({ delta: null, reason: '' });
    this.adjustDialogOpen.set(true);
  }

  closeAdjustDialog(): void {
    if (this.adjusting() || this.pendingAdjustment()) return;
    this.adjustDialogOpen.set(false);
    this.activeBalance.set(null);
    this.adjustError.set('');
  }

  submitAdjustment(): void {
    const balance = this.activeBalance();
    if (!balance || !this.canAdjust() || this.adjusting()) return;

    let payload = this.pendingAdjustment();
    if (!payload) {
      this.adjustmentForm.markAllAsTouched();
      if (this.adjustmentForm.invalid) return;
      const raw = this.adjustmentForm.getRawValue();
      if (raw.delta === null) return;
      const next = balance.onHand + raw.delta;
      if (next < balance.reserved || next > MAX_STOCK_QUANTITY) {
        this.adjustError.set('Tồn sau điều chỉnh phải từ số đã giữ đến 2.147.483.647.');
        return;
      }
      payload = {
        inventoryItemId: balance.id,
        version: balance.version,
        operationId: '',
        delta: raw.delta,
        reason: raw.reason.trim(),
      };
    }

    const actionKey = `adjust-${balance.id}`;
    this.adjustError.set('');
    this.runIdempotent(
      actionKey,
      {
        inventoryItemId: payload.inventoryItemId,
        version: payload.version,
        delta: payload.delta,
        reason: payload.reason,
      },
      (operationId) => {
        const request: AdjustInventoryRequest = { ...payload, operationId };
        this.pendingAdjustment.set(request);
        this.adjustmentForm.disable({ emitEvent: false });
        return this.inventoryService.adjustStock(balance.id, request);
      },
      {
        busy: this.adjusting,
        successMessage: 'Đã ghi nhận điều chỉnh tồn kho.',
        onSuccess: () => {
          this.pendingAdjustment.set(null);
          this.adjustmentForm.enable({ emitEvent: false });
          this.adjustDialogOpen.set(false);
          this.activeBalance.set(null);
          this.loadBalances(this.balancesPage()?.page ?? 1);
          if (this.movementsBalance()?.id === balance.id) {
            this.loadMovementsPage(1);
          }
        },
        onError: (apiError) => {
          if (!['network', 'server', 'rate-limit'].includes(apiError.kind)) {
            this.pendingAdjustment.set(null);
            this.adjustmentForm.enable({ emitEvent: false });
          }
          this.adjustError.set(apiError.message);
        },
      },
    );
  }

  openMovementsDrawer(balance: InventoryBalanceDto): void {
    if (!this.canPhysicalView()) return;
    this.movementsBalance.set(balance);
    this.movementsPage.set(null);
    this.movementsError.set('');
    this.movementsDrawerOpen.set(true);
    this.loadMovementsPage(1);
  }

  loadMovementsPage(page = 1): void {
    const balance = this.movementsBalance();
    if (!balance || !this.canPhysicalView()) return;
    this.movementsError.set('');
    this.run(this.inventoryService.getMovements(balance.id, page, INVENTORY_PAGE_SIZE), {
      busy: this.movementsLoading,
      onSuccess: (result) => this.movementsPage.set(result),
      onError: (apiError) => this.movementsError.set(apiError.message),
    });
  }

  selectVariantForDigital(variantId: string): void {
    if (!variantId.trim()) return;
    this.variantLookupInput.set(variantId.trim());
    this.lookupDigitalVariant();
  }

  lookupDigitalVariant(page = 1): void {
    const variantId = this.variantLookupInput().trim();
    if (!variantId || !this.canDigitalView()) return;
    this.activeVariantId.set(variantId);
    this.digitalError.set('');
    this.hideSecret();
    this.run(this.digitalService.getItems(variantId, page, INVENTORY_PAGE_SIZE), {
      busy: this.digitalLoading,
      onSuccess: (itemsPage) => {
        this.digitalItemsPage.set(itemsPage);
        this.refreshAvailability(variantId);
      },
      onError: (apiError) => {
        this.digitalError.set(apiError.message);
      },
    });
  }

  openImportDialog(): void {
    const variantId = this.activeVariantId();
    if (!variantId || !this.canDigitalImport()) return;
    const sampleItem = this.digitalItemsPage()?.items[0];
    this.importError.set('');
    this.digitalImportForm.reset({
      productId: sampleItem?.productId ?? '',
      version: sampleItem?.productVersion ?? '',
      batch: '',
    });
    this.importDialogOpen.set(true);
  }

  closeImportDialog(): void {
    if (this.digitalWorking()) return;
    this.importDialogOpen.set(false);
    this.importError.set('');
  }

  submitBatchImport(): void {
    const variantId = this.activeVariantId();
    if (!variantId || !this.canDigitalImport() || this.digitalWorking()) return;
    this.digitalImportForm.markAllAsTouched();
    if (this.digitalImportForm.invalid) return;
    const raw = this.digitalImportForm.getRawValue();
    const parsed = parseDigitalBatchLines(raw.batch);
    if (parsed.error) {
      this.importError.set(parsed.error);
      return;
    }
    this.importError.set('');
    const requestPayload = {
      productId: raw.productId.trim(),
      variantId,
      version: raw.version.trim(),
      items: parsed.items,
    };
    this.runIdempotent(
      `digital-import-${variantId}`,
      requestPayload,
      (operationId) =>
        this.digitalService.importBatch(variantId, { ...requestPayload, operationId }, operationId),
      {
        busy: this.digitalWorking,
        successMessage: `Đã nhập ${parsed.items.length} mục nội dung số.`,
        onSuccess: () => {
          this.importDialogOpen.set(false);
          this.lookupDigitalVariant(1);
        },
        onError: (apiError) => {
          this.importError.set(apiError.message);
        },
      },
    );
  }

  toggleItemAvailability(item: DigitalInventoryItemDto): void {
    if (!this.canDigitalUpdate() || this.digitalWorking() || item.state > 2) return;
    this.digitalError.set('');
    this.hideSecret();
    this.run(
      this.digitalService.setItemAvailability(item.variantId, item.id, {
        productId: item.productId,
        variantId: item.variantId,
        stockItemId: item.id,
        version: item.productVersion,
        isAvailable: item.state !== 1,
      }),
      {
        busy: this.digitalWorking,
        successMessage:
          item.state === 1 ? 'Đã ngừng cung cấp mục số.' : 'Đã mở lại cung cấp mục số.',
        onSuccess: () => {
          this.lookupDigitalVariant(this.digitalItemsPage()?.page ?? 1);
        },
        onError: (apiError) => {
          this.digitalError.set(apiError.message);
        },
      },
    );
  }

  revealItemSecret(item: DigitalInventoryItemDto): void {
    if (!this.canDigitalReveal() || this.revealingItemId() !== null) return;
    this.hideSecret();
    this.revealingItemId.set(item.id);
    this.digitalError.set('');
    this.run(this.digitalService.revealSecret(item.id), {
      onSuccess: (revealed) => {
        this.revealingItemId.set(null);
        this.revealedItemId.set(item.id);
        this.revealedSecret.set(revealed.content);
      },
      onError: (apiError) => {
        this.revealingItemId.set(null);
        this.digitalError.set(apiError.message);
      },
    });
  }

  hideSecret(): void {
    this.revealingItemId.set(null);
    this.revealedItemId.set(null);
    this.revealedSecret.set(null);
  }

  balanceTone(balance: InventoryBalanceDto): 'success' | 'warning' | 'muted' {
    if (balance.available <= 0) return 'warning';
    if (balance.available <= LOW_STOCK_THRESHOLD) return 'warning';
    return 'success';
  }

  balanceLabel(balance: InventoryBalanceDto): string {
    if (balance.available <= 0) return 'Hết hàng';
    if (balance.available <= LOW_STOCK_THRESHOLD) return 'Sắp hết';
    return 'Sẵn hàng';
  }

  digitalTone(state: number): 'success' | 'warning' | 'neutral' | 'muted' {
    if (state === 1) return 'success';
    if (state === 2) return 'warning';
    if (state === 3) return 'neutral';
    return 'muted';
  }

  protected error(control: AbstractControl | null): string {
    return validationMessage(control);
  }

  private refreshAvailability(variantId: string): void {
    this.run(this.digitalService.getAvailability(variantId), {
      onSuccess: (summary) => {
        if (this.activeVariantId() === variantId) {
          this.digitalAvailability.set(summary);
        }
      },
    });
  }
}
