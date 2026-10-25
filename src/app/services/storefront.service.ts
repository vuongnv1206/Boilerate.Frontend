import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/http/api-client';
import { CategoryDto } from '@models/category.dto';
import { ProductDto, ProductPage, ProductSearch } from '@models/product.dto';
import { GuestPaymentSettings } from '@models/storefront-settings.dto';

@Injectable({ providedIn: 'root' })
export class StorefrontService {
  private readonly api = inject(ApiClient);

  searchProducts(request: ProductSearch): Observable<ProductPage> {
    return this.api.post<ProductPage>('catalog/products/search', request);
  }

  getProductBySlug(slug: string): Observable<ProductDto> {
    return this.api.get<ProductDto>(`catalog/products/${encodeURIComponent(slug)}`);
  }

  getCategories(): Observable<readonly CategoryDto[]> {
    return this.api.get<readonly CategoryDto[]>('catalog/categories');
  }

  getPaymentSettings(): Observable<GuestPaymentSettings> {
    return this.api.get<GuestPaymentSettings>('storefront/settings', { withCredentials: true });
  }
}
