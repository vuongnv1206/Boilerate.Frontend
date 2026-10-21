import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '@core/auth/auth-session';
import { MediaService } from '@services/media.service';
import { MediaPreviewStore } from './media-preview.store';

describe('MediaPreviewStore resource lifecycle', () => {
  const signedIn = signal(true);
  const createUrl = vi.fn();
  const revokeUrl = vi.fn();
  let store: MediaPreviewStore;
  let version: number;
  let service: { preview: ReturnType<typeof vi.fn> };
  const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

  beforeEach(() => {
    signedIn.set(true);
    version = 1;
    createUrl.mockReset().mockImplementation(() => `blob:preview-${createUrl.mock.calls.length}`);
    revokeUrl.mockReset();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeUrl });
    service = { preview: vi.fn(() => of(new Blob(['png'], { type: 'image/png' }))) };
    TestBed.configureTestingModule({
      providers: [
        MediaPreviewStore,
        { provide: MediaService, useValue: service },
        { provide: AuthSession, useValue: { signedIn, getVersion: () => version } },
      ],
    });
    store = TestBed.inject(MediaPreviewStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('deduplicates requests and releases URLs when media leave the view or owner is destroyed', () => {
    store.load(['a', 'a', 'b']);
    expect(service.preview).toHaveBeenCalledTimes(2);
    expect(store.url('a')).toBe('blob:preview-1');
    store.load(['b']);
    expect(revokeUrl).toHaveBeenCalledWith('blob:preview-1');
    expect(store.url('a')).toBeNull();
    expect(service.preview).toHaveBeenCalledTimes(2);
    TestBed.resetTestingModule();
    expect(revokeUrl).toHaveBeenCalledWith('blob:preview-2');
  });

  it('cancels an image request removed before its response', () => {
    const cancelled = vi.fn();
    service.preview.mockReturnValue(new Observable(() => cancelled));
    store.load(['a']);
    expect(store.loading('a')).toBe(true);
    store.load([]);
    expect(cancelled).toHaveBeenCalledOnce();
    expect(store.loading('a')).toBe(false);
  });

  it('clears all previews and cancels pending reads on logout', () => {
    const pending = new Subject<Blob>();
    service.preview.mockReturnValueOnce(of(new Blob(['png'], { type: 'image/png' })));
    service.preview.mockReturnValueOnce(pending);
    store.load(['a', 'b']);
    TestBed.tick();
    signedIn.set(false);
    TestBed.tick();
    expect(revokeUrl).toHaveBeenCalledWith('blob:preview-1');
    expect(store.url('a')).toBeNull();
    expect(store.loading('b')).toBe(false);
    pending.next(new Blob(['png'], { type: 'image/png' }));
    expect(createUrl).toHaveBeenCalledOnce();
  });

  it('ignores responses belonging to a previous session even before logout effect runs', () => {
    const pending = new Subject<Blob>();
    service.preview.mockReturnValue(pending);
    store.load(['a']);
    version = 2;
    pending.next(new Blob(['png'], { type: 'image/png' }));
    expect(store.url('a')).toBeNull();
    expect(createUrl).not.toHaveBeenCalled();
  });

  it('does not turn an unsupported response into an image URL and allows an explicit retry', () => {
    service.preview.mockReturnValueOnce(of(new Blob(['markup'], { type: 'text/html' })));
    store.load(['a']);
    expect(store.error('a')).toBe('Không thể xem tệp ảnh này.');
    store.load(['a']);
    expect(service.preview).toHaveBeenCalledOnce();
    store.reload('a');
    expect(store.error('a')).toBe('');
    expect(store.url('a')).toBe('blob:preview-1');
  });
});
