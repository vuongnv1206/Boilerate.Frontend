import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '@core/base';
import {
  AddProductVariant,
  BulkProductStatus,
  BulkProductStatusResult,
  ChangeProductStatus,
  CreateProduct,
  EditProduct,
  EditProductOption,
  EditProductVariant,
  ProductDto,
  ProductPage,
  ProductSearch,
  SaveProductEditor,
} from '../models/product.dto';

@Injectable({ providedIn: 'root' })
export class ProductsService extends BaseApiService {
  search(request: ProductSearch): Observable<ProductPage> {
    return this.post<ProductPage>('products/search', request);
  }

  getById(id: string): Observable<ProductDto> {
    return this.get<ProductDto>(`products/${encodeURIComponent(id)}`);
  }

  getProduct(id: string): Observable<ProductDto> {
    return this.getById(id);
  }

  create(request: CreateProduct): Observable<ProductDto> {
    return this.post<ProductDto>('products', request);
  }

  edit(request: EditProduct): Observable<ProductDto> {
    return this.put<ProductDto>(`products/${encodeURIComponent(request.id)}`, request);
  }

  saveEditor(request: SaveProductEditor): Observable<ProductDto> {
    return this.put<ProductDto>(`products/${encodeURIComponent(request.id)}/editor`, request);
  }

  deleteProduct(id: string, version: string): Observable<boolean> {
    return this.deleteResource<boolean>(`products/${encodeURIComponent(id)}`, { version });
  }

  bulkStatus(request: BulkProductStatus): Observable<BulkProductStatusResult> {
    return this.post<BulkProductStatusResult>('products/bulk-status', request);
  }

  changeStatus(request: ChangeProductStatus): Observable<ProductDto> {
    return this.post<ProductDto>(`products/${encodeURIComponent(request.id)}/status`, request);
  }

  addVariant(request: AddProductVariant): Observable<ProductDto> {
    return this.post<ProductDto>(
      `products/${encodeURIComponent(request.productId)}/variants`,
      request,
    );
  }

  editVariant(request: EditProductVariant): Observable<ProductDto> {
    return this.put<ProductDto>(
      `products/${encodeURIComponent(request.productId)}/variants/${encodeURIComponent(request.variantId)}`,
      request,
    );
  }

  setDefaultVariant(productId: string, variantId: string, version: string): Observable<ProductDto> {
    return this.put<ProductDto>(`products/${encodeURIComponent(productId)}/default-variant`, {
      productId,
      variantId,
      version,
    });
  }

  editOption(request: EditProductOption): Observable<ProductDto> {
    return this.put<ProductDto>(
      `products/${encodeURIComponent(request.productId)}/options/${encodeURIComponent(request.optionId)}`,
      request,
    );
  }
}
