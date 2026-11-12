import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import { CategoryDto, ProductDto, ProductPage, ProductSearch } from '../models/storefront.dto';

@Injectable({ providedIn: 'root' })
export class PublicCatalogService {
  constructor(private readonly api: ApiService) {}

  searchProducts(request: ProductSearch): Observable<ProductPage> {
    return this.api.post<ProductPage>('catalog/products/search', request);
  }

  getProductBySlug(slug: string): Observable<ProductDto> {
    return this.api.get<ProductDto>(`catalog/products/${encodeURIComponent(slug)}`);
  }

  getCategories(): Observable<readonly CategoryDto[]> {
    return this.api.get<readonly CategoryDto[]>('catalog/categories');
  }
}
