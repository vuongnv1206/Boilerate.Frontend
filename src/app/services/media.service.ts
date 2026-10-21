import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/http/api-client';
import { MediaAssetDto } from '@models/media.dto';

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly api = inject(ApiClient);

  upload(file: File): Observable<MediaAssetDto> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.api.post<MediaAssetDto>('media', body);
  }

  preview(id: string): Observable<Blob> {
    return this.api.blob(`media/${encodeURIComponent(id)}`);
  }
}
