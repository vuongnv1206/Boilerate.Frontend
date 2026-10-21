import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideRuntimeConfig } from '@core/config/runtime-config.token';
import { MediaService } from '@services/media.service';

describe('MediaService transport', () => {
  let service: MediaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRuntimeConfig({ apiBaseUrl: '/api' }),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(MediaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('uploads the multipart file without setting a JSON content type', () => {
    const file = new File(['png'], 'ảnh.png', { type: 'image/png' });
    service.upload(file).subscribe((asset) => expect(asset.id).toBe('asset-a'));
    const request = http.expectOne('/api/media');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect((request.request.body as FormData).get('file')).toMatchObject({
      name: file.name,
      size: file.size,
      type: file.type,
    });
    expect(request.request.headers.has('Content-Type')).toBe(false);
    request.flush({
      id: 'asset-a',
      contentType: 'image/png',
      size: 3,
      state: 'Ready',
      version: 'v1',
    });
  });

  it('loads a blob through the configured API and supports cancellation', () => {
    const subscription = service.preview('asset-a').subscribe();
    const request = http.expectOne('/api/media/asset-a');
    expect(request.request.responseType).toBe('blob');
    subscription.unsubscribe();
    expect(request.cancelled).toBe(true);
  });
});
