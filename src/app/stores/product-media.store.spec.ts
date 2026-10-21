import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error';
import { MAX_PRODUCT_IMAGE_BYTES } from '@constants/media.constants';
import { MediaAssetDto } from '@models/media.dto';
import { MediaService } from '@services/media.service';
import { ProductMediaStore } from './product-media.store';

const asset: MediaAssetDto = {
  id: 'asset-a',
  contentType: 'image/png',
  size: 3,
  state: 'Ready',
  version: 'v1',
};
const image = (): File => new File(['png'], 'image.png', { type: 'image/png' });

describe('ProductMediaStore uploads', () => {
  const allowed = signal(true);
  const signedIn = signal(true);
  let store: ProductMediaStore;
  let service: { upload: ReturnType<typeof vi.fn> };
  let version: number;

  beforeEach(() => {
    allowed.set(true);
    signedIn.set(true);
    version = 1;
    service = { upload: vi.fn(() => of(asset)) };
    TestBed.configureTestingModule({
      providers: [
        ProductMediaStore,
        { provide: MediaService, useValue: service },
        {
          provide: AuthSession,
          useValue: { can: () => allowed(), signedIn, getVersion: () => version },
        },
      ],
    });
    store = TestBed.inject(ProductMediaStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('validates the whole batch before sending any upload', () => {
    store
      .upload([image(), new File(['x'], 'photo.svg', { type: 'image/svg+xml' })], 30)
      .subscribe();
    expect(store.error()).toBe('Chọn ảnh PNG hoặc JPEG.');
    expect(service.upload).not.toHaveBeenCalled();
    store.upload([image(), image()], 1).subscribe();
    expect(store.error()).toContain('30 ảnh');
    const oversized = new File([new Uint8Array(MAX_PRODUCT_IMAGE_BYTES + 1)], 'photo.png', {
      type: 'image/png',
    });
    store.upload([oversized], 30).subscribe();
    expect(store.error()).toContain('5 MiB');
    expect(service.upload).not.toHaveBeenCalled();
  });

  it('serializes uploads, blocks duplicate submissions and emits only confirmed assets', () => {
    const first = new Subject<MediaAssetDto>();
    const second = new Subject<MediaAssetDto>();
    service.upload.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const received: string[] = [];
    store.upload([image(), image()], 30).subscribe((value) => received.push(value.id));
    expect(service.upload).toHaveBeenCalledOnce();
    expect(store.busy()).toBe(true);
    store.upload([image()], 30).subscribe();
    expect(service.upload).toHaveBeenCalledOnce();
    first.next(asset);
    expect(received).toEqual(['asset-a']);
    first.complete();
    expect(service.upload).toHaveBeenCalledTimes(2);
    second.next({ ...asset, id: 'asset-b' });
    second.complete();
    expect(received).toEqual(['asset-a', 'asset-b']);
    expect(store.busy()).toBe(false);
  });

  it('preserves successful uploads and reports failure without replaying the request', () => {
    service.upload
      .mockReturnValueOnce(of(asset))
      .mockReturnValueOnce(
        throwError(
          () =>
            new ApiError({ status: 0, kind: 'network', message: 'Mất kết nối', fieldErrors: {} }),
        ),
      );
    const received: MediaAssetDto[] = [];
    store.upload([image(), image(), image()], 30).subscribe((value) => received.push(value));
    expect(received).toEqual([asset]);
    expect(service.upload).toHaveBeenCalledTimes(2);
    expect(store.error()).toBe('Mất kết nối');
    expect(store.busy()).toBe(false);
  });

  it('enforces upload permission and rejects a response after the session changes', () => {
    allowed.set(false);
    store.upload([image()], 30).subscribe();
    expect(service.upload).not.toHaveBeenCalled();
    allowed.set(true);
    const pending = new Subject<MediaAssetDto>();
    service.upload.mockReturnValue(pending);
    const received = vi.fn();
    store.upload([image(), image()], 30).subscribe(received);
    version = 2;
    pending.next(asset);
    pending.complete();
    expect(received).not.toHaveBeenCalled();
    expect(service.upload).toHaveBeenCalledOnce();
  });
});
