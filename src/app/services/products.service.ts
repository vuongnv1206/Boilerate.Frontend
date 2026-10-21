import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/http/api-client';
import { ProductCategoryLookup, ProductTypeLookup } from '@models/product-lookups.dto';
import {
  ChangeProductStatus,
  CreateProduct,
  EditProduct,
  ProductDto,
  ProductPage,
  ProductSearch,
} from '@models/product.dto';

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

  changeStatus(request: ChangeProductStatus): Observable<ProductDto> {
    return this.api.post<ProductDto>(`products/${encodeURIComponent(request.id)}/status`, request);
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
