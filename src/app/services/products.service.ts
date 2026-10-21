import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/http/api-client';
import { ProductCategoryLookup, ProductTypeLookup } from '@models/product-lookups.dto';
import {
  ChangeProductStatus,
  AddProductVariant,
  EditProductVariant,
  EditProductOption,
  CreateProduct,
  EditProduct,
  ProductDto,
  ProductPage,
  ProductSearch,
  SaveProductEditor,
  BulkProductStatus,
  BulkProductStatusResult,
} from '@models/product.dto';
import {
  AdjustInventory,
  CatalogPage,
  DigitalStock,
  DigitalStockInput,
  InventoryBalance,
  InventoryMovement,
} from '@models/inventory.dto';

/** Catalog endpoint adapter. No UI state, retries, fake records or guessed DTOs. */
@Injectable()
export class ProductsService {
  private readonly api = inject(ApiClient);

  search(request: ProductSearch): Observable<ProductPage> {
    return this.api.post<ProductPage>('products/search', request);
  }

  get(id: string): Observable<ProductDto> {
    return this.api.get<ProductDto>(`products/${encodeURIComponent(id)}`);
  }

  create(request: CreateProduct): Observable<ProductDto> {
    return this.api.post<ProductDto>('products', request);
  }

  edit(request: EditProduct): Observable<ProductDto> {
    return this.api.put<ProductDto>(`products/${encodeURIComponent(request.id)}`, request);
  }

  saveEditor(request: SaveProductEditor): Observable<ProductDto> {
    return this.api.put<ProductDto>(`products/${encodeURIComponent(request.id)}/editor`, request);
  }

  bulkStatus(request: BulkProductStatus): Observable<BulkProductStatusResult> {
    return this.api.post<BulkProductStatusResult>('products/bulk-status', request);
  }

  changeStatus(request: ChangeProductStatus): Observable<ProductDto> {
    return this.api.post<ProductDto>(`products/${encodeURIComponent(request.id)}/status`, request);
  }

  addVariant(request: AddProductVariant): Observable<ProductDto> {
    return this.api.post<ProductDto>(
      `products/${encodeURIComponent(request.productId)}/variants`,
      request,
    );
  }

  editVariant(request: EditProductVariant): Observable<ProductDto> {
    return this.api.put<ProductDto>(
      `products/${encodeURIComponent(request.productId)}/variants/${encodeURIComponent(request.variantId)}`,
      request,
    );
  }

  setDefaultVariant(productId: string, variantId: string, version: string): Observable<ProductDto> {
    return this.api.put<ProductDto>(`products/${encodeURIComponent(productId)}/default-variant`, {
      productId,
      variantId,
      version,
    });
  }

  editOption(request: EditProductOption): Observable<ProductDto> {
    return this.api.put<ProductDto>(
      `products/${encodeURIComponent(request.productId)}/options/${encodeURIComponent(request.optionId)}`,
      request,
    );
  }

  inventory(productId: string, page = 1): Observable<CatalogPage<InventoryBalance>> {
    return this.api.get<CatalogPage<InventoryBalance>>('inventory', {
      params: { productId, page, size: 100 },
    });
  }

  adjustInventory(request: AdjustInventory): Observable<InventoryMovement> {
    return this.api.post<InventoryMovement>(
      `inventory/${encodeURIComponent(request.inventoryItemId)}/adjustments`,
      request,
    );
  }

  inventoryMovements(id: string, page = 1): Observable<CatalogPage<InventoryMovement>> {
    return this.api.get<CatalogPage<InventoryMovement>>(
      `inventory/${encodeURIComponent(id)}/movements`,
      { params: { page, size: 20 } },
    );
  }

  digitalStock(variantId: string, page = 1): Observable<CatalogPage<DigitalStock>> {
    return this.api.get<CatalogPage<DigitalStock>>(
      `digital-inventory/variants/${encodeURIComponent(variantId)}`,
      { params: { page, size: 20 } },
    );
  }

  importDigital(
    productId: string,
    variantId: string,
    version: string,
    items: readonly DigitalStockInput[],
  ): Observable<readonly DigitalStock[]> {
    return this.api.post<readonly DigitalStock[]>(
      `digital-inventory/variants/${encodeURIComponent(variantId)}/items`,
      { productId, variantId, version, items },
    );
  }

  saveSharedDigital(
    productId: string,
    variantId: string,
    version: string,
    content: string,
    isActive: boolean,
  ): Observable<DigitalStock> {
    return this.api.put<DigitalStock>(
      `digital-inventory/variants/${encodeURIComponent(variantId)}/shared-content`,
      { productId, variantId, version, content, isActive },
    );
  }

  setDigitalAvailability(
    productId: string,
    variantId: string,
    stockItemId: string,
    version: string,
    isAvailable: boolean,
  ): Observable<DigitalStock> {
    return this.api.put<DigitalStock>(
      `digital-inventory/variants/${encodeURIComponent(variantId)}/items/${encodeURIComponent(stockItemId)}/availability`,
      { productId, variantId, stockItemId, version, isAvailable },
    );
  }

  revealDigital(id: string): Observable<{ readonly id: string; readonly content: string }> {
    return this.api.post<{ readonly id: string; readonly content: string }>(
      `digital-inventory/items/${encodeURIComponent(id)}/reveal`,
      {},
    );
  }

  categories(): Observable<readonly ProductCategoryLookup[]> {
    return this.api.get<readonly ProductCategoryLookup[]>('categories');
  }

  productTypes(): Observable<readonly ProductTypeLookup[]> {
    return this.api.get<readonly ProductTypeLookup[]>('product-types');
  }

  productType(id: string): Observable<ProductTypeLookup> {
    return this.api.get<ProductTypeLookup>(`product-types/${encodeURIComponent(id)}`);
  }
}
