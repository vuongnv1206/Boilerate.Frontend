import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/http/api-client';
import { CartDto, SaveCartRequest } from '@models/cart.dto';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly api = inject(ApiClient);

  getCart(): Observable<CartDto> {
    return this.api.get<CartDto>('cart', { withCredentials: true });
  }

  getGuestCart(): Observable<CartDto> {
    return this.api.get<CartDto>('storefront/cart', { withCredentials: true });
  }

  saveCart(request: SaveCartRequest): Observable<CartDto> {
    return this.api.put<CartDto>('cart', request, { withCredentials: true });
  }

  saveGuestCart(request: SaveCartRequest): Observable<CartDto> {
    return this.api.put<CartDto>('storefront/cart', request, { withCredentials: true });
  }
}
