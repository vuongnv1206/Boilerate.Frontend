import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import {
  CreateProductTypeRequest,
  EditProductTypeRequest,
  ProductTypeDto,
} from '../models/product-type.dto';

@Injectable({ providedIn: 'root' })
export class ProductTypesService {
  private readonly basePath = 'product-types';

  constructor(private readonly api: ApiService) {}

  getAll(): Observable<readonly ProductTypeDto[]> {
    return this.api.get<readonly ProductTypeDto[]>(this.basePath);
  }

  getById(id: string): Observable<ProductTypeDto> {
    return this.api.get<ProductTypeDto>(`${this.basePath}/${encodeURIComponent(id)}`);
  }

  create(request: CreateProductTypeRequest): Observable<ProductTypeDto> {
    return this.api.post<ProductTypeDto>(this.basePath, request);
  }

  update(id: string, request: EditProductTypeRequest): Observable<ProductTypeDto> {
    return this.api.put<ProductTypeDto>(`${this.basePath}/${encodeURIComponent(id)}`, request);
  }
}
