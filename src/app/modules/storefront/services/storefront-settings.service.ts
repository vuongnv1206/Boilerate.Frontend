import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '@core/base';
import {
  GuestPaymentSettings,
  StorefrontSettings,
  UpdateStorefrontSettings,
} from '../models/storefront-settings.dto';

@Injectable({ providedIn: 'root' })
export class StorefrontSettingsService extends BaseApiService {
  getPublicSettings(): Observable<GuestPaymentSettings> {
    return this.get<GuestPaymentSettings>('storefront/settings', undefined, {
      withCredentials: true,
    });
  }

  getAdminSettings(): Observable<StorefrontSettings> {
    return this.get<StorefrontSettings>('admin/storefront-settings');
  }

  updateAdminSettings(body: UpdateStorefrontSettings): Observable<StorefrontSettings> {
    return this.put<StorefrontSettings>('admin/storefront-settings', body);
  }
}
