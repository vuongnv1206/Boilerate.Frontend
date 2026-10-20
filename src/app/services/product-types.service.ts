import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../core/http/api-client';
import {
  CreateProductTypeRequest,
  EditProductTypeRequest,
  ProductTypeDto,
} from '@models/product-type.dto';

@Injectable()
export class ProductTypesService {
  private readonly api = inject(ApiClient);

  getAll(): Observable<readonly ProductTypeDto[]> {
    return this.api.get<readonly ProductTypeDto[]>('product-types');
  }
  getById(id: string): Observable<ProductTypeDto> {
    return this.api.get<ProductTypeDto>(`product-types/${encodeURIComponent(id)}`);
  }
  create(request: CreateProductTypeRequest): Observable<ProductTypeDto> {
    return this.api.post<ProductTypeDto>('product-types', request);
  }
  update(id: string, request: EditProductTypeRequest): Observable<ProductTypeDto> {
    return this.api.put<ProductTypeDto>(`product-types/${encodeURIComponent(id)}`, request);
  }
}
