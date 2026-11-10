import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseCrudService } from '@core/base';
import {
  CategoryDto,
  CategoryProductChange,
  CategoryProductCount,
  CategoryProductResult,
  SaveCategoryRequest,
} from '../models/category.dto';

@Injectable({ providedIn: 'root' })
export class CategoriesService extends BaseCrudService<
  CategoryDto,
  SaveCategoryRequest,
  SaveCategoryRequest
> {
  protected readonly endpoint = 'categories';

  summaries(): Observable<readonly CategoryProductCount[]> {
    return this.get<readonly CategoryProductCount[]>('categories/summaries');
  }

  deleteCategory(id: string, version: string): Observable<boolean> {
    return this.deleteResource<boolean>(this.itemPath(id), { version });
  }

  setProducts(
    id: string,
    changes: readonly CategoryProductChange[],
  ): Observable<CategoryProductResult[]> {
    return this.put<CategoryProductResult[]>(this.itemPath(id, 'products'), {
      categoryId: id,
      changes,
    });
  }
}
