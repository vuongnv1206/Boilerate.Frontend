import {
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
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { DrawerModule } from 'primeng/drawer';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { Icon } from '../../shared/ui/icon/icon';
import { focusWhenVisible } from '../../shared/ui/focus-when-visible';

interface PreviewRecord {
  id: string;
  name: string;
  category: string;
  status: string;
}

@Component({
  selector: 'app-control-gallery',
  imports: [
    FormsModule,
    CheckboxModule,
    DatePickerModule,
    DialogModule,
    DrawerModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    MultiSelectModule,
    SelectModule,
    TableModule,
    TabsModule,
    TextareaModule,
    ToastModule,
    ToggleSwitchModule,
    TooltipModule,
    Icon,
  ],
  providers: [MessageService],
  templateUrl: './control-gallery.html',
  styleUrl: './control-gallery.scss',
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

  readonly categories = [
    { label: 'Đồ dùng trong nhà', value: 'home' },
    { label: 'Phụ kiện cá nhân', value: 'accessories' },
    { label: 'Ấn phẩm & văn phòng', value: 'stationery' },
  ];
  readonly tags = [
    { label: 'Mới ra mắt', value: 'new' },
    { label: 'Làm thủ công', value: 'handmade' },
    { label: 'Vật liệu tự nhiên', value: 'natural' },
    { label: 'Phiên bản giới hạn', value: 'limited' },
  ];
  readonly records: PreviewRecord[] = [
    {
      id: '01',
      name: 'Bình gốm dáng cao — màu cát',
      category: 'Đồ dùng trong nhà',
      status: 'Đã xuất bản',
    },
    {
      id: '02',
      name: 'Túi vải dệt từ sợi bông tự nhiên',
      category: 'Phụ kiện cá nhân',
      status: 'Bản nháp',
    },
    {
      id: '03',
      name: 'Sổ tay giấy ngà, bìa vải xanh',
      category: 'Ấn phẩm & văn phòng',
      status: 'Đã xuất bản',
    },
    {
      id: '04',
      name: 'Khay gỗ nhỏ cho góc làm việc',
      category: 'Đồ dùng trong nhà',
      status: 'Bản nháp',
    },
    {
      id: '05',
      name: 'Cốc gốm men mờ — bộ hai chiếc',
      category: 'Đồ dùng trong nhà',
      status: 'Đã xuất bản',
    },
    {
      id: '06',
      name: 'Thiệp cảm ơn in trên giấy tái chế',
      category: 'Ấn phẩm & văn phòng',
      status: 'Bản nháp',
    },
  ];

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.loadingTimer !== undefined) clearTimeout(this.loadingTimer);
    });
  }

  previewSave(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.saveStatus.set('Đang lưu bản xem thử…');
    this.loadingTimer = setTimeout(() => {
      this.saving.set(false);
      this.saveStatus.set('Đã lưu trong bản xem thử');
      this.showToast();
    }, 1200);
  }

  showToast(): void {
    this.messages.add({
      severity: 'success',
      summary: 'Bản xem thử đã sẵn sàng',
      detail: 'Thao tác minh họa đã hoàn tất. Không có dữ liệu gửi lên máy chủ.',
      life: 4500,
    });
  }

  previewDelete(): void {
    this.messages.add({
      severity: 'warn',
      summary: 'Thao tác xóa minh họa',
      detail: 'Không có nội dung nào bị xóa trong bản xem thử này.',
      life: 4500,
    });
  }

  closeDialog(): void {
    this.dialogVisible.set(false);
    this.showToast();
  }
}
