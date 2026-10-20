import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PopoverModule } from 'primeng/popover';
import { SelectModule } from 'primeng/select';
import { Icon } from '../../../shared/ui/icon/icon';
import {
  collectionDefinition,
  CollectionKey,
  ContentItem,
  ContentStatus,
  filterItems,
  STATUS_LABELS,
} from '../content-model';
import { DemoContentStore } from '../demo-content-store';

@Component({
  selector: 'app-collection-list',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    RouterLink,
    Icon,
    CheckboxModule,
    DialogModule,
    InputTextModule,
    PopoverModule,
    SelectModule,
  ],
  templateUrl: './collection-list.html',
  styleUrl: './collection-list.scss',
})
export class CollectionList {
  readonly store = inject(DemoContentStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private previousCollection: CollectionKey | undefined;
  private readonly params = toSignal(this.route.paramMap);
  readonly definition = computed(() =>
    collectionDefinition(this.params()?.get('collection') ?? null),
  );
  readonly query = signal('');
  readonly status = signal<ContentStatus | 'all'>('all');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly selectedIds = signal(new Set<string>());
  readonly notice = signal('');
  readonly deleteOpen = signal(false);
  readonly menuItem = signal<ContentItem | null>(null);
  readonly visibleColumns = signal(new Set(['status', 'category', 'price', 'updated']));
  readonly statusLabels = STATUS_LABELS;
  readonly statuses = [
    { label: 'Tất cả trạng thái', value: 'all' },
    { label: 'Đã xuất bản', value: 'published' },
    { label: 'Bản nháp', value: 'draft' },
    { label: 'Đã lưu trữ', value: 'archived' },
  ];
  readonly columnOptions = [
    { key: 'status', label: 'Trạng thái' },
    { key: 'category', label: 'Danh mục' },
    { key: 'price', label: 'Giá bán' },
    { key: 'updated', label: 'Cập nhật gần nhất' },
  ];
  readonly collectionItems = computed(() =>
    this.store.items().filter((item) => item.collection === this.definition().key),
  );
  readonly filtered = computed(() =>
    filterItems(this.collectionItems(), this.query(), this.status()),
  );
  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize())),
  );
  readonly currentPage = computed(() => Math.min(this.page(), this.pageCount()));
  readonly pageItems = computed(() =>
    this.filtered().slice(
      (this.currentPage() - 1) * this.pageSize(),
      this.currentPage() * this.pageSize(),
    ),
  );
  readonly allPageSelected = computed(
    () =>
      this.pageItems().length > 0 &&
      this.pageItems().every((item) => this.selectedIds().has(item.id)),
  );
  readonly rangeStart = computed(() =>
    this.filtered().length ? (this.currentPage() - 1) * this.pageSize() + 1 : 0,
  );
  readonly rangeEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.filtered().length),
  );
  readonly visibleSelection = computed(() =>
    this.collectionItems().filter((item) => this.selectedIds().has(item.id)),
  );

  constructor() {
    effect(() => {
      const key = this.definition().key;
      untracked(() => {
        if (this.previousCollection) this.rememberView(this.previousCollection);
        const state = this.store.getListView(key);
        this.query.set(state.query);
        this.status.set(state.status);
        this.page.set(state.page);
        this.pageSize.set(state.pageSize);
        this.visibleColumns.set(new Set(state.columns));
        this.selectedIds.set(new Set());
        this.notice.set('');
        this.previousCollection = key;
      });
    });
    this.destroyRef.onDestroy(() => {
      if (this.previousCollection) this.rememberView(this.previousCollection);
    });
  }

  private rememberView(key: CollectionKey): void {
    this.store.setListView(key, {
      query: this.query(),
      status: this.status(),
      page: this.page(),
      pageSize: this.pageSize(),
      columns: [...this.visibleColumns()],
    });
  }

  setQuery(value: string): void {
    this.query.set(value);
    this.resetPagination();
  }
  setStatus(value: ContentStatus | 'all'): void {
    this.status.set(value);
    this.resetPagination();
  }
  resetFilters(): void {
    this.query.set('');
    this.status.set('all');
    this.resetPagination();
  }
  toggleItem(id: string): void {
    this.selectedIds.update((selected) => {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  clearSelection(): void {
    this.selectedIds.set(new Set());
  }
  toggleAll(): void {
    const allSelected = this.allPageSelected();
    this.selectedIds.update((selected) => {
      const next = new Set(selected);
      this.pageItems().forEach((item) => {
        if (allSelected) next.delete(item.id);
        else next.add(item.id);
      });
      return next;
    });
  }
  toggleColumn(key: string): void {
    this.visibleColumns.update((columns) => {
      const next = new Set(columns);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  open(item: ContentItem): void {
    void this.router.navigate(['/admin/items', item.id]);
  }
  duplicate(item: ContentItem | null): void {
    if (!item) return;
    const copy = this.store.duplicate(item.id);
    if (copy) {
      this.notice.set(`Đã tạo bản sao “${item.name}” trong bản mẫu.`);
    }
  }
  archive(item: ContentItem | null): void {
    if (!item) return;
    this.store.setStatus(new Set([item.id]), 'archived');
    this.notice.set(`Đã lưu trữ “${item.name}” trong bản mẫu.`);
  }
  archiveSelected(): void {
    this.store.setStatus(new Set(this.visibleSelection().map((item) => item.id)), 'archived');
    this.notice.set(`Đã lưu trữ ${this.visibleSelection().length} mục trong bản mẫu.`);
    this.selectedIds.set(new Set());
  }
  deleteSelected(): void {
    this.store.remove(new Set(this.visibleSelection().map((item) => item.id)));
    this.selectedIds.set(new Set());
    this.deleteOpen.set(false);
    this.notice.set('Đã xóa các mục đã chọn khỏi bản mẫu.');
  }
  exportCsv(): void {
    const values = [
      ['Tên', 'Slug', 'Trạng thái', 'Danh mục'],
      ...this.filtered().map((item) => [
        item.name,
        item.slug,
        STATUS_LABELS[item.status],
        item.category,
      ]),
    ];
    const csv = values
      .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.definition().key}-demo.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.notice.set('Đã xuất dữ liệu đang lọc thành CSV minh họa.');
  }
  private resetPagination(): void {
    this.page.set(1);
    this.selectedIds.set(new Set());
  }
}
