import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/http/api-client';
import {
  CategoryDto,
  CategoryProductChange,
  CategoryProductCount,
  CategoryProductResult,
  SaveCategoryRequest,
} from '@models/category.dto';

@Injectable()
export class CategoriesService {
  private readonly api = inject(ApiClient);

  getAll(): Observable<readonly CategoryDto[]> {
    return this.api.get<readonly CategoryDto[]>('categories');
  }
  summaries(): Observable<readonly CategoryProductCount[]> {
    return this.api.get<readonly CategoryProductCount[]>('categories/summaries');
  }
  create(request: SaveCategoryRequest): Observable<CategoryDto> {
    return this.api.post<CategoryDto>('categories', request);
  }
  update(id: string, request: SaveCategoryRequest): Observable<CategoryDto> {
    return this.api.put<CategoryDto>(`categories/${encodeURIComponent(id)}`, request);
  }
  delete(id: string, version: string): Observable<boolean> {
    return this.api.delete<boolean>(`categories/${encodeURIComponent(id)}`, {
      params: { version },
    });
  }
  setProducts(
    id: string,
    changes: readonly CategoryProductChange[],
  ): Observable<CategoryProductResult[]> {
    return this.api.put<CategoryProductResult[]>(`categories/${encodeURIComponent(id)}/products`, {
      categoryId: id,
      changes,
    });
  }
}
