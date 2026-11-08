import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { MessageService } from 'primeng/api';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { ContentStateKind } from '@shared/ui/content-state/content-state.model';
import { focusWhenVisible } from '@shared/ui/focus-when-visible';
import {
  GALLERY_CATEGORIES,
  GALLERY_PREVIEW_RECORDS,
  GALLERY_SAVE_DELAY_MS,
  GALLERY_TAGS,
  GALLERY_TOAST_LIFETIME_MS,
  GalleryTab,
  PreviewRecord,
} from '../models/ui-gallery.model';

@Component({
  selector: 'app-control-gallery',
  imports: [SHARED_IMPORTS],
  providers: [MessageService],
  templateUrl: './control-gallery.component.html',
  styleUrl: '../../../../styles/admin/_gallery.scss',
})
export class ControlGallery {
  // System variables
  private readonly drawerName = viewChild<ElementRef<HTMLInputElement>>('drawerName');
  private overlayTrigger: HTMLElement | null = null;
  private loadingTimer: ReturnType<typeof setTimeout> | undefined;
  readonly dialogVisible = signal(false);
  readonly drawerVisible = signal(false);
  readonly saving = signal(false);
  readonly saveStatus = signal('Chưa có thay đổi');
  readonly statePreview = signal<ContentStateKind>('empty');

  // Business variables
  readonly collectionName = signal('Bộ sưu tập mùa thu');
  readonly title = signal('');
  readonly titleInvalid = computed(() => this.title().trim().length === 0);
  readonly description = signal('Những vật dụng giản dị, được làm để gắn bó với mỗi ngày.');
  readonly price = signal<number | null>(450000);
  readonly category = signal('home');
  readonly selectedTags = signal<string[]>(['new']);
  readonly publishDate = signal<Date | null>(null);
  readonly featured = signal(true);
  readonly notifications = signal(false);
  readonly selectedRecords = signal<PreviewRecord[]>([]);
  readonly selectedCount = computed(() => this.selectedRecords().length);

  readonly categories = GALLERY_CATEGORIES.slice();
  readonly tags = GALLERY_TAGS.slice();
  readonly records = GALLERY_PREVIEW_RECORDS.map((record) => ({ ...record }));
  readonly tabs = GalleryTab;

  constructor(
    private readonly messages: MessageService,
    private readonly destroyRef: DestroyRef,
    private readonly injector: Injector,
  ) {
    this.destroyRef.onDestroy(() => {
      if (this.loadingTimer !== undefined) clearTimeout(this.loadingTimer);
    });
  }

  openDialog(event: Event): void {
    this.overlayTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.dialogVisible.set(true);
  }

  openDrawer(event: Event): void {
    this.overlayTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.drawerVisible.set(true);
  }

  focusDrawer(): void {
    afterNextRender(
      () => {
        const input = this.drawerName()?.nativeElement;
        const panel = input?.closest<HTMLElement>('.p-drawer');
        focusWhenVisible(panel ?? undefined, input, () => this.drawerVisible());
      },
      { injector: this.injector },
    );
  }

  restoreOverlayFocus(): void {
    this.overlayTrigger?.focus();
    this.overlayTrigger = null;
  }

  previewSave(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.saveStatus.set('Đang lưu bản xem thử…');
    this.loadingTimer = setTimeout(() => {
      this.saving.set(false);
      this.saveStatus.set('Đã lưu trong bản xem thử');
      this.showToast();
    }, GALLERY_SAVE_DELAY_MS);
  }

  showToast(): void {
    this.messages.add({
      severity: 'success',
      summary: 'Bản xem thử đã sẵn sàng',
      detail: 'Thao tác minh họa đã hoàn tất. Không có dữ liệu gửi lên máy chủ.',
      life: GALLERY_TOAST_LIFETIME_MS,
    });
  }

  previewDelete(): void {
    this.messages.add({
      severity: 'warn',
      summary: 'Thao tác xóa minh họa',
      detail: 'Không có nội dung nào bị xóa trong bản xem thử này.',
      life: GALLERY_TOAST_LIFETIME_MS,
    });
  }

  closeDialog(): void {
    this.dialogVisible.set(false);
    this.showToast();
  }
}
