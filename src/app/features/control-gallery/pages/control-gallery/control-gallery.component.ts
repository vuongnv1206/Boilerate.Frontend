import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Checkbox } from 'primeng/checkbox';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { Drawer } from 'primeng/drawer';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { Table, TableCheckbox, TableHeaderCheckbox } from 'primeng/table';
import { Tabs, Tab, TabList, TabPanel, TabPanels } from 'primeng/tabs';
import { Textarea } from 'primeng/textarea';
import { Toast } from 'primeng/toast';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { Icon } from '@shared/ui/icon/icon.component';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { ContentStateKind } from '@shared/ui/content-state/content-state.model';
import { FieldMessage } from '@shared/ui/field-message/field-message.component';
import { StatusBadge } from '@shared/ui/status-badge/status-badge.component';
import { focusWhenVisible } from '@shared/ui/focus-when-visible';
import {
  GALLERY_CATEGORIES,
  GALLERY_TAGS,
  GALLERY_PREVIEW_RECORDS,
  GALLERY_SAVE_DELAY_MS,
  GALLERY_TOAST_LIFETIME_MS,
} from '@constants/gallery.constants';
import { GalleryTab } from '@enums/gallery-tab.enum';
import { PreviewRecord } from '@models/preview-record.model';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-control-gallery',
  imports: [
    FormsModule,
    Checkbox,
    DatePicker,
    Dialog,
    Drawer,
    InputNumber,
    InputText,
    Message,
    MultiSelect,
    Select,
    Table,
    TableCheckbox,
    TableHeaderCheckbox,
    Tabs,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Textarea,
    Toast,
    ToggleSwitch,
    Tooltip,
    Icon,
    ContentState,
    FieldMessage,
    StatusBadge,
  ],
  providers: [MessageService],
  templateUrl: './control-gallery.component.html',
  styleUrl: '../../../../../styles/admin/_gallery.scss',
})
export class ControlGallery {
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly drawerName = viewChild<ElementRef<HTMLInputElement>>('drawerName');
  private overlayTrigger: HTMLElement | null = null;
  private loadingTimer: ReturnType<typeof setTimeout> | undefined;

  readonly dialogVisible = signal(false);
  readonly drawerVisible = signal(false);
  readonly saving = signal(false);
  readonly saveStatus = signal('Chưa có thay đổi');
  readonly statePreview = signal<ContentStateKind>('empty');
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

  constructor() {
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
