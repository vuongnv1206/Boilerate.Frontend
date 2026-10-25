import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/http/api-client';
import { StorefrontSettings, UpdateStorefrontSettings } from '@models/storefront-settings.dto';

@Injectable({ providedIn: 'root' })
export class StorefrontSettingsService {
  private readonly api = inject(ApiClient);

  get(): Observable<StorefrontSettings> {
    return this.api.get<StorefrontSettings>('admin/storefront-settings');
  }

  update(request: UpdateStorefrontSettings): Observable<StorefrontSettings> {
    return this.api.put<StorefrontSettings>('admin/storefront-settings', request);
  }
}
