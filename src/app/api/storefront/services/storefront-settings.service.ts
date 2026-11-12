import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import {
  GuestPaymentSettings,
  StorefrontSettings,
  UpdateStorefrontSettings,
} from '../models/storefront-settings.dto';

@Injectable({ providedIn: 'root' })
export class StorefrontSettingsService {
  constructor(private readonly api: ApiService) {}

  getPublicSettings(): Observable<GuestPaymentSettings> {
    return this.api.get<GuestPaymentSettings>('storefront/settings', undefined, {
      withCredentials: true,
    });
  }

  getAdminSettings(): Observable<StorefrontSettings> {
    return this.api.get<StorefrontSettings>('admin/storefront-settings');
  }

  updateAdminSettings(body: UpdateStorefrontSettings): Observable<StorefrontSettings> {
    return this.api.put<StorefrontSettings>('admin/storefront-settings', body);
  }
}
