import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductMedia } from '@features/collections/products/product-media/product-media.component';
import { ProductMedia as ProductMediaDto } from '@models/product.dto';
import { MediaPreviewStore } from '@stores/media-preview.store';
import { ProductMediaStore } from '@stores/product-media.store';

describe('ProductMedia gallery edits', () => {
  let fixture: ComponentFixture<ProductMedia>;
  let screen: ProductMedia;
  const busy = signal(false);
  const upload = vi.fn();
  const media: readonly ProductMediaDto[] = [
    { mediaAssetId: 'a', sortOrder: 1, altText: null },
    { mediaAssetId: 'b', sortOrder: 0, altText: 'Ảnh mặt trước' },
  ];

  beforeEach(async () => {
    busy.set(false);
    upload.mockReset().mockReturnValue(of());
    TestBed.configureTestingModule({ imports: [ProductMedia] });
    TestBed.overrideComponent(ProductMedia, {
      set: {
        providers: [
          {
            provide: ProductMediaStore,
            useValue: { busy, error: signal(''), canUpload: signal(true), upload },
          },
          {
            provide: MediaPreviewStore,
            useValue: {
              load: vi.fn(),
              url: () => null,
              loading: () => false,
              error: () => '',
              reload: vi.fn(),
            },
          },
        ],
      },
    });
    fixture = TestBed.createComponent(ProductMedia);
    screen = fixture.componentInstance;
    fixture.componentRef.setInput('media', media);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('keeps image IDs stable while changing order, alt text and gallery membership', () => {
    const changed = vi.fn();
    const removed = vi.fn();
    screen.mediaChange.subscribe(changed);
    screen.removed.subscribe(removed);
    screen.move('a', -1);
    expect(changed).toHaveBeenLastCalledWith([
      { mediaAssetId: 'a', sortOrder: 0, altText: null },
      { mediaAssetId: 'b', sortOrder: 1, altText: 'Ảnh mặt trước' },
    ]);
    const input = document.createElement('input');
    input.value = 'Mặt sau';
    screen.altText('a', { target: input } as unknown as Event);
    expect(changed.mock.lastCall?.[0][1]).toEqual({
      mediaAssetId: 'a',
      sortOrder: 1,
      altText: 'Mặt sau',
    });
    screen.remove('b');
    expect(changed).toHaveBeenLastCalledWith([{ mediaAssetId: 'a', sortOrder: 0, altText: null }]);
    expect(removed).toHaveBeenCalledWith('b');
    expect(media[0]?.sortOrder).toBe(1);
  });

  it('accumulates multiple confirmed uploads even before the parent input is refreshed', () => {
    upload.mockReturnValue(of({ id: 'c' }, { id: 'd' }));
    const changed = vi.fn();
    screen.mediaChange.subscribe(changed);
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'files', {
      value: [new File(['c'], 'c.png'), new File(['d'], 'd.png')],
    });
    screen.upload({ target: input } as unknown as Event);
    expect(changed.mock.lastCall?.[0].map((item: ProductMediaDto) => item.mediaAssetId)).toEqual([
      'b',
      'a',
      'c',
      'd',
    ]);
    expect(upload).toHaveBeenCalledWith(Array.from(input.files ?? []), 28);
  });

  it('disables native edits and ignores handlers while readonly or uploading', () => {
    const changed = vi.fn();
    screen.mediaChange.subscribe(changed);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement).disabled,
    ).toBe(true);
    screen.remove('a');
    screen.move('a', -1);
    expect(changed).not.toHaveBeenCalled();
    fixture.componentRef.setInput('disabled', false);
    busy.set(true);
    fixture.detectChanges();
    screen.remove('a');
    expect(changed).not.toHaveBeenCalled();
  });
});
