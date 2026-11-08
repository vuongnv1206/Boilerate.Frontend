import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '@core/base';
import { CategoryDto, ProductDto, ProductPage, ProductSearch } from '../models/storefront.dto';

@Injectable({ providedIn: 'root' })
export class PublicCatalogService extends BaseApiService {
  searchProducts(request: ProductSearch): Observable<ProductPage> {
    return this.post<ProductPage>('catalog/products/search', request);
  }

  getProductBySlug(slug: string): Observable<ProductDto> {
    return this.get<ProductDto>(`catalog/products/${encodeURIComponent(slug)}`);
  }

  getCategories(): Observable<readonly CategoryDto[]> {
    return this.get<readonly CategoryDto[]>('catalog/categories');
  }
}
