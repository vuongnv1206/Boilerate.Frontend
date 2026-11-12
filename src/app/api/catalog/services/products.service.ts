import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/http/api.service';
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
export class ProductsService {
  constructor(private readonly api: ApiService) {}

  search(request: ProductSearch): Observable<ProductPage> {
    return this.api.post<ProductPage>('products/search', request);
  }

  getById(id: string): Observable<ProductDto> {
    return this.api.get<ProductDto>(`products/${encodeURIComponent(id)}`);
  }

  getProduct(id: string): Observable<ProductDto> {
    return this.getById(id);
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

  deleteProduct(id: string, version: string): Observable<boolean> {
    return this.api.delete<boolean>(`products/${encodeURIComponent(id)}`, { version });
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
}
