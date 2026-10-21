import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { InputText } from 'primeng/inputtext';
import { MAX_PRODUCT_MEDIA, PRODUCT_IMAGE_ACCEPT } from '@constants/media.constants';
import { ProductMedia as ProductMediaDto } from '@models/product.dto';
import { MediaPreviewStore } from '@stores/media-preview.store';
import { ProductMediaStore } from '@stores/product-media.store';
import { Icon } from '@shared/ui/icon/icon.component';

@Component({
  selector: 'app-product-media',
  imports: [InputText, Icon],
  providers: [MediaPreviewStore, ProductMediaStore],
  templateUrl: './product-media.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductMedia {
  readonly media = input<readonly ProductMediaDto[]>([]);
  readonly disabled = input(false);
  readonly mediaChange = output<readonly ProductMediaDto[]>();
  readonly removed = output<string>();
  readonly busyChange = output<boolean>();
  readonly store = inject(ProductMediaStore);
  readonly previews = inject(MediaPreviewStore);
  readonly accept = PRODUCT_IMAGE_ACCEPT;
  readonly limit = MAX_PRODUCT_MEDIA;
  readonly items = computed(() => [...this.media()].sort((a, b) => a.sortOrder - b.sortOrder));
  readonly blocked = computed(() => this.disabled() || this.store.busy());

  constructor() {
    effect(() => {
      const ids = this.media().map((item) => item.mediaAssetId);
      untracked(() => this.previews.load(ids));
    });
    effect(() => this.busyChange.emit(this.store.busy()));
  }

  upload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (this.blocked()) return;
    let items = this.items();
    this.store.upload(files, this.limit - this.media().length).subscribe((asset) => {
      items = [...items, { mediaAssetId: asset.id, sortOrder: items.length, altText: null }];
      this.mediaChange.emit(items);
    });
  }

  move(id: string, direction: -1 | 1): void {
    if (this.blocked()) return;
    const items = [...this.items()];
    const index = items.findIndex((item) => item.mediaAssetId === id);
    const target = index + direction;
    const item = items[index];
    const other = items[target];
    if (!item || !other) return;
    items[index] = other;
    items[target] = item;
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

  private emit(items: readonly ProductMediaDto[]): void {
    this.mediaChange.emit(items.map((item, sortOrder) => ({ ...item, sortOrder })));
  }
}
