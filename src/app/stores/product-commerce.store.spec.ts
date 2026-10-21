import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error';
import { ProductFulfillmentKind, ProductStatus } from '@enums/product.enum';
import { ProductDto } from '@models/product.dto';
import { InventoryBalance, InventoryMovement } from '@models/inventory.dto';
import { ProductsService } from '@services/products.service';
import { ProductCommerceStore } from '@stores/product-commerce.store';

describe('ProductCommerceStore', () => {
  const product: ProductDto = {
    id: 'p1',
    version: 'pv1',
    productTypeId: 't1',
    name: 'Áo',
    slug: 'ao',
    description: null,
    status: ProductStatus.Draft,
    fulfillmentKind: ProductFulfillmentKind.Physical,
    categoryIds: [],
    fields: [],
    media: [],
    options: [
      {
        id: 'o1',
        code: 'COLOR',
        name: 'Màu',
        sortOrder: 0,
        values: [
          { id: 'red', code: 'RED', label: 'Đỏ', sortOrder: 0 },
          { id: 'blue', code: 'BLUE', label: 'Xanh', sortOrder: 1 },
        ],
      },
    ],
    variants: [
      {
        id: 'v1',
        sku: 'A-RED',
        combinationKey: 'red',
        price: 100,
        compareAtPrice: 200,
        currency: 'VND',
        isDefault: true,
        isActive: true,
        imageMediaId: null,
        inStock: true,
        selections: [{ optionId: 'o1', optionValueId: 'red' }],
      },
    ],
  };
  const balance: InventoryBalance = {
    id: 'i1',
    variantId: 'v1',
    locationId: 'main',
    version: 'iv1',
    onHand: 10,
    reserved: 3,
    available: 7,
  };
  const movement: InventoryMovement = {
    id: 'm1',
    inventoryItemId: 'i1',
    operationId: 'op1',
    delta: 2,
    quantityAfter: 12,
    reason: 'Nhập hàng',
    actorId: 'a1',
    createdAt: '2026-10-21T00:00:00Z',
  };
  const service = {
    inventory: vi.fn(),
    inventoryMovements: vi.fn(),
    get: vi.fn(),
    editVariant: vi.fn(),
    addVariant: vi.fn(),
    setDefaultVariant: vi.fn(),
    editOption: vi.fn(),
    adjustInventory: vi.fn(),
    digitalStock: vi.fn(),
    importDigital: vi.fn(),
    saveSharedDigital: vi.fn(),
    setDigitalAvailability: vi.fn(),
    revealDigital: vi.fn(),
  };
  let store: ProductCommerceStore;
  let changed = vi.fn<(product: ProductDto) => void>();
  let grants: Set<string>;
  const grantsRevision = signal(0);
  beforeEach(() => {
    Object.values(service).forEach((method) => method.mockReset());
    grants = new Set([
      'Product.Update',
      'Price.Update',
      'Inventory.View',
      'Inventory.Adjust',
      'DigitalInventory.View',
      'DigitalInventory.Import',
      'DigitalInventory.Update',
      'DigitalInventory.Reveal',
    ]);
    service.inventory.mockReturnValue(
      of({ items: [balance], total: 1, pageNumber: 1, pageSize: 100 }),
    );
    service.inventoryMovements.mockReturnValue(
      of({ items: [], total: 0, pageNumber: 1, pageSize: 20 }),
    );
    service.get.mockReturnValue(of({ ...product, version: 'pv2' }));
    service.editVariant.mockReturnValue(of({ ...product, version: 'pv2' }));
    service.addVariant.mockReturnValue(of({ ...product, version: 'pv2' }));
    service.adjustInventory.mockReturnValue(of(movement));
    TestBed.configureTestingModule({
      providers: [
        ProductCommerceStore,
        { provide: ProductsService, useValue: service },
        {
          provide: AuthSession,
          useValue: {
            can: (fn: string, action: string) => {
              grantsRevision();
              return grants.has(`${fn}.${action}`);
            },
          },
        },
      ],
    });
    store = TestBed.inject(ProductCommerceStore);
    changed = vi.fn();
    store.connect(changed);
    store.sync(product, false);
  });
  it('uses product version for editing prices, keeps draft/version on 409 and rebases only after explicit reload', () => {
    store.openVariant(product.variants[0] ?? null);
    store.variantForm.controls.price.setValue(150);
    service.editVariant.mockReturnValue(
      throwError(
        () => new ApiError({ status: 409, kind: 'conflict', message: 'conflict', fieldErrors: {} }),
      ),
    );
    store.saveVariant();
    expect(service.editVariant).toHaveBeenCalledWith(
      expect.objectContaining({ version: 'pv1', price: 150, compareAtPrice: 200 }),
    );
    expect(store.variantForm.controls.price.value).toBe(150);
    expect(store.item()?.version).toBe('pv1');
    expect(store.mode()).toBe('variant');
    store.reloadCanonical();
    expect(store.item()?.version).toBe('pv2');
    expect(store.variantForm.controls.price.value).toBe(150);
  });
  it('never changes a retried adjustment snapshot after response loss and prevents duplicate submit while busy', () => {
    store.openInventory(balance);
    store.adjustmentForm.setValue({ delta: 2, reason: ' Nhập hàng ' });
    service.adjustInventory.mockReturnValue(
      throwError(
        () => new ApiError({ status: 0, kind: 'network', message: 'network', fieldErrors: {} }),
      ),
    );
    store.adjust();
    const original = service.adjustInventory.mock.calls[0]?.[0];
    expect(original).toMatchObject({ version: 'iv1', delta: 2, reason: 'Nhập hàng' });
    expect(store.pendingAdjustment()).toEqual(original);
    expect(store.adjustmentForm.disabled).toBe(true);
    store.adjustmentForm.controls.delta.setValue(99);
    const response = new Subject<InventoryMovement>();
    service.adjustInventory.mockReturnValue(response);
    store.adjust();
    store.adjust();
    expect(service.adjustInventory).toHaveBeenCalledTimes(2);
    expect(service.adjustInventory.mock.calls[1]?.[0]).toEqual(original);
    response.next(movement);
    response.complete();
    expect(store.pendingAdjustment()).toBe(null);
    expect(store.adjustmentForm.controls.delta.value).toBe(null);
    expect(service.inventory).toHaveBeenCalledWith(product.id);
    expect(changed).toHaveBeenCalled();
  });

  it('locks mutations until canonical reload completes and updates readonly prices without wiping editable draft', () => {
    grants.delete('Price.Update');
    grantsRevision.update((value) => value + 1);
    store.openVariant(product.variants[0] ?? null);
    store.variantForm.controls.isActive.setValue(false);
    const reload = new Subject<ProductDto>();
    service.get.mockReturnValue(reload);
    store.reloadCanonical();
    expect(store.busy()).toBe(true);
    store.saveVariant();
    expect(service.editVariant).not.toHaveBeenCalled();
    reload.next({
      ...product,
      version: 'pv3',
      variants: product.variants.map((variant) => ({
        ...variant,
        price: 300,
        compareAtPrice: 400,
      })),
    });
    reload.complete();
    expect(store.busy()).toBe(false);
    expect(store.variantForm.controls.price.value).toBe(300);
    expect(store.variantForm.controls.isActive.value).toBe(false);
    store.saveVariant();
    expect(service.editVariant).toHaveBeenCalledWith(
      expect.objectContaining({ version: 'pv3', price: 300, compareAtPrice: 400, isActive: false }),
    );
  });
  it('blocks an adjustment below reserved quantity and blocks actions without their independent permissions', () => {
    store.openInventory(balance);
    store.adjustmentForm.setValue({ delta: -8, reason: 'Mất hàng' });
    store.adjust();
    expect(service.adjustInventory).not.toHaveBeenCalled();
    store.close();
    grants.delete('Price.Update');
    store.openVariant(product.variants[0] ?? null);
    expect(store.variantForm.controls.price.disabled).toBe(true);
    store.variantForm.controls.price.setValue(999);
    store.saveVariant();
    expect(service.editVariant).not.toHaveBeenCalled();
    store.close();
    grants.delete('Product.Update');
    grantsRevision.update((value) => value + 1);
    store.openVariant(null);
    expect(store.mode()).toBe(null);
  });
  it('rejects existing option combinations and leaves disabled SKUs in the uniqueness check', () => {
    store.openVariant(null);
    store.variantForm.controls.sku.setValue('A-RED2');
    store.variantForm.controls.selections.controls['COLOR']?.setValue('RED');
    store.saveVariant();
    expect(service.addVariant).not.toHaveBeenCalled();
    expect(store.error()).toContain('Tổ hợp');
    store.variantForm.controls.selections.controls['COLOR']?.setValue('BLUE');
    store.saveVariant();
    expect(service.addVariant).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 'pv1',
        variant: expect.objectContaining({ options: { COLOR: 'BLUE' } }),
      }),
    );
  });
  it('follows all filtered balance pages and ignores a late stock read from a different product', () => {
    const old = new Subject<{
      items: InventoryBalance[];
      total: number;
      pageNumber: number;
      pageSize: number;
    }>();
    service.inventory.mockReturnValue(old);
    store.loadInventory();
    service.inventory.mockImplementation((_id: string, page = 1) =>
      of(
        page === 1
          ? { items: [balance], total: 2, pageNumber: 1, pageSize: 1 }
          : { items: [{ ...balance, id: 'i2' }], total: 2, pageNumber: 2, pageSize: 1 },
      ),
    );
    store.sync({ ...product, id: 'p2' }, false);
    old.next({ items: [{ ...balance, id: 'stale' }], total: 1, pageNumber: 1, pageSize: 100 });
    old.complete();
    expect(store.balances().map((row) => row.id)).toEqual(['i1', 'i2']);
  });
});
