import { Injectable } from '@angular/core';
import { BaseCrudService } from '@core/base';
import {
  CreateProductTypeRequest,
  EditProductTypeRequest,
  ProductTypeDto,
} from '../models/product-type.dto';

@Injectable({ providedIn: 'root' })
export class ProductTypesService extends BaseCrudService<
  ProductTypeDto,
  CreateProductTypeRequest,
  EditProductTypeRequest
> {
  protected readonly endpoint = 'product-types';
}
