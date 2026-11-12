import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import {
  CategoryDto,
  CategoryProductChange,
  CategoryProductCount,
  CategoryProductResult,
  SaveCategoryRequest,
} from '../models/category.dto';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly basePath = 'categories';

  constructor(private readonly api: ApiService) {}

  getAll(): Observable<readonly CategoryDto[]> {
    return this.api.get<readonly CategoryDto[]>(this.basePath);
  }

  summaries(): Observable<readonly CategoryProductCount[]> {
    return this.api.get<readonly CategoryProductCount[]>(`${this.basePath}/summaries`);
  }

  create(request: SaveCategoryRequest): Observable<CategoryDto> {
    return this.api.post<CategoryDto>(this.basePath, request);
  }

  update(id: string, request: SaveCategoryRequest): Observable<CategoryDto> {
    return this.api.put<CategoryDto>(`${this.basePath}/${encodeURIComponent(id)}`, request);
  }

  deleteCategory(id: string, version: string): Observable<boolean> {
    return this.api.delete<boolean>(`${this.basePath}/${encodeURIComponent(id)}`, { version });
  }

  setProducts(
    id: string,
    changes: readonly CategoryProductChange[],
  ): Observable<CategoryProductResult[]> {
    return this.api.put<CategoryProductResult[]>(
      `${this.basePath}/${encodeURIComponent(id)}/products`,
      { categoryId: id, changes },
    );
  }
}
