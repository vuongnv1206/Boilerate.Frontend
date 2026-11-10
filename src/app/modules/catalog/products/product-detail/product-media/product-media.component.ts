import { Component, DestroyRef, computed, effect, input, output, untracked } from '@angular/core';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { MAX_PRODUCT_MEDIA, PRODUCT_IMAGE_ACCEPT } from '@api/catalog/models/media.dto';
import { ProductMediaDto } from '@api/catalog/models/product.dto';
import { MediaService } from '@api/catalog/services/media.service';

@Component({
  selector: 'app-product-media',
  imports: [SHARED_IMPORTS],
  templateUrl: './product-media.component.html',
})
export class ProductMedia {
  // System variables
  private readonly previewOwner = Symbol('product-media');
  protected readonly accept = PRODUCT_IMAGE_ACCEPT;

  // Business variables
  readonly media = input<readonly ProductMediaDto[]>([]);
  readonly disabled = input(false);
  readonly heading = input('Hình ảnh');
  readonly uploadId = input('product-media-upload');
  readonly maximum = input(MAX_PRODUCT_MEDIA);

  readonly mediaChange = output<readonly ProductMediaDto[]>();
  readonly removed = output<string>();
  readonly busyChange = output<boolean>();

  readonly limit = computed(() => this.maximum());
  readonly items = computed(() => [...this.media()].sort((a, b) => a.sortOrder - b.sortOrder));
  readonly blocked = computed(() => this.disabled() || this.mediaService.busy());

  constructor(
    private readonly destroyRef: DestroyRef,
    protected readonly mediaService: MediaService,
  ) {
    effect(() => {
      const ids = this.media().map((item) => item.mediaAssetId);
      untracked(() => this.mediaService.retainPreviews(this.previewOwner, ids));
    });
    effect(() => {
      this.busyChange.emit(this.mediaService.busy());
    });
    this.destroyRef.onDestroy(() => {
      this.mediaService.releasePreviews(this.previewOwner);
    });
  }

  upload(event: Event): void {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files ?? []);
    target.value = '';
    if (this.blocked()) return;
    this.uploadFiles(files);
  }

  drop(event: DragEvent): void {
    event.preventDefault();
    if (!this.blocked()) {
      this.uploadFiles(Array.from(event.dataTransfer?.files ?? []));
    }
  }

  move(id: string, direction: -1 | 1): void {
    if (this.blocked()) return;
    const items = [...this.items()];
    const index = items.findIndex((item) => item.mediaAssetId === id);
    const targetIndex = index + direction;
    const item = items[index];
    const other = items[targetIndex];
    if (!item || !other) return;
    items[index] = other;
    items[targetIndex] = item;
    this.emit(items);
  }

  altText(id: string, event: Event): void {
    if (this.blocked()) return;
    const alt = (event.target as HTMLInputElement).value.slice(0, 500);
    this.emit(
      this.items().map((item) =>
        item.mediaAssetId === id ? { ...item, altText: alt || null } : item,
      ),
    );
  }

  remove(id: string): void {
    if (this.blocked()) return;
    this.emit(this.items().filter((item) => item.mediaAssetId !== id));
    this.removed.emit(id);
  }

  private uploadFiles(files: readonly File[]): void {
    let items = this.items();
    this.mediaService.upload(files, this.limit() - this.media().length).subscribe((asset) => {
      items = [...items, { mediaAssetId: asset.id, sortOrder: items.length, altText: null }];
      this.mediaChange.emit(items);
    });
  }

  private emit(items: readonly ProductMediaDto[]): void {
    this.mediaChange.emit(items.map((item, sortOrder) => ({ ...item, sortOrder })));
  }
}
