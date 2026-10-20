import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  Subscription,
  catchError,
  defer,
  finalize,
  switchMap,
  take,
} from 'rxjs';
import { normalizeApiError } from '../../../core/http/normalize-api-error';
import {
  CONTENT_DEFAULT_COLUMNS,
  CONTENT_DEFAULT_PAGE_SIZE,
  CONTENT_PAGE_SIZES,
} from '../constants/content-table.constants';
import { CONTENT_ALL_STATUSES } from '../constants/content-toolbar.constants';
import { ContentService } from '../data-access/content.service';
import { ContentColumn } from '../enums/content-table.enum';
import { CollectionKey, ContentStatus } from '../enums/content.enum';
import { collectionDefinition, ContentItem, filterItems } from '../models/content-item';
import { ContentStatusFilter } from '../models/content-view.model';
import { ContentExport } from '../services/content-export';
import { ContentViewStore } from './content-view.store';

/** One list instance owns its query and selection, never the shared record source. */
@Injectable()
export class ContentStore {
  private readonly service = inject(ContentService);
  private readonly views = inject(ContentViewStore);
  private readonly exporter = inject(ContentExport);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loads = new Subject<CollectionKey>();
  private collection: CollectionKey | undefined;
  private command: Subscription | undefined;
  private readonly records = signal<readonly ContentItem[]>([]);
  private readonly collectionKey = signal<CollectionKey>(CollectionKey.Products);
  private readonly queryValue = signal('');
  private readonly statusValue = signal<ContentStatusFilter>(CONTENT_ALL_STATUSES);
  private readonly pageValue = signal(1);
  private readonly pageSizeValue = signal<number>(CONTENT_DEFAULT_PAGE_SIZE);
  private readonly selection = signal<ReadonlySet<string>>(new Set());
  private readonly columns = signal<ReadonlySet<ContentColumn>>(new Set(CONTENT_DEFAULT_COLUMNS));
  private readonly noticeValue = signal('');
  private readonly errorValue = signal('');
  private readonly loadingValue = signal(false);
  private readonly busyValue = signal(false);

  readonly definition = computed(() => collectionDefinition(this.collectionKey()));
  readonly collectionItems = this.records.asReadonly();
  readonly query = this.queryValue.asReadonly();
  readonly status = this.statusValue.asReadonly();
  readonly pageSize = this.pageSizeValue.asReadonly();
  readonly selectedIds = this.selection.asReadonly();
  readonly visibleColumns = this.columns.asReadonly();
  readonly notice = this.noticeValue.asReadonly();
  readonly error = this.errorValue.asReadonly();
  readonly loading = this.loadingValue.asReadonly();
  readonly busy = this.busyValue.asReadonly();
  readonly filtered = computed(() => filterItems(this.records(), this.query(), this.status()));
  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize())),
  );
  readonly currentPage = computed(() => Math.min(this.pageValue(), this.pageCount()));
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
    this.records().filter((item) => this.selectedIds().has(item.id)),
  );

  constructor() {
    this.loads
      .pipe(
        switchMap((key) =>
          defer(() => {
            this.loadingValue.set(true);
            this.errorValue.set('');
            return this.service.getCollection(key);
          }).pipe(
            catchError((error: unknown) => {
              this.errorValue.set(normalizeApiError(error).message);
              this.loadingValue.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        this.records.set(items);
        this.selection.update(
          (selected) =>
            new Set(items.filter((item) => selected.has(item.id)).map((item) => item.id)),
        );
        this.loadingValue.set(false);
      });
    this.destroyRef.onDestroy(() => {
      this.rememberView();
      this.command?.unsubscribe();
    });
  }

  connect(key: CollectionKey): void {
    if (this.collection === key) return;
    this.rememberView();
    this.command?.unsubscribe();
    this.collection = key;
    this.collectionKey.set(key);
    const view = this.views.get(key);
    this.queryValue.set(view.query);
    this.statusValue.set(view.status);
    this.pageValue.set(view.page);
    this.pageSizeValue.set(view.pageSize);
    this.columns.set(new Set(view.columns));
    this.selection.set(new Set());
    this.noticeValue.set('');
    this.records.set([]);
    this.loads.next(key);
  }

  retry(): void {
    if (this.collection) this.loads.next(this.collection);
  }

  setQuery(value: string): void {
    this.queryValue.set(value);
    this.resetPagination();
  }

  setStatus(value: ContentStatusFilter): void {
    this.statusValue.set(value);
    this.resetPagination();
  }

  resetFilters(): void {
    this.queryValue.set('');
    this.statusValue.set(CONTENT_ALL_STATUSES);
    this.resetPagination();
  }

  setPage(value: number): void {
    this.pageValue.set(Math.max(1, Math.min(value, this.pageCount())));
  }

  setPageSize(value: number): void {
    if (!CONTENT_PAGE_SIZES.some((size) => size === value)) return;
    this.pageSizeValue.set(value);
    this.pageValue.set(1);
  }

  toggleItem(id: string): void {
    if (!this.records().some((item) => item.id === id)) return;
    this.selection.update((selected) => {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  clearSelection(): void {
    this.selection.set(new Set());
  }

  toggleAll(): void {
    const allSelected = this.allPageSelected();
    this.selection.update((selected) => {
      const next = new Set(selected);
      this.pageItems().forEach((item) => {
        if (allSelected) next.delete(item.id);
        else next.add(item.id);
      });
      return next;
    });
  }

  toggleColumn(key: ContentColumn): void {
    this.columns.update((columns) => {
      const next = new Set(columns);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  dismissNotice(): void {
    this.noticeValue.set('');
  }

  duplicate(item: ContentItem): void {
    this.run(
      () => this.service.duplicate(item.id),
      (copy) => {
        if (copy) this.noticeValue.set(`Đã tạo bản sao “${item.name}” trong bản mẫu.`);
      },
    );
  }

  archive(item: ContentItem): void {
    this.run(
      () => this.service.setStatus([item.id], ContentStatus.Archived),
      () => {
        this.noticeValue.set(`Đã lưu trữ “${item.name}” trong bản mẫu.`);
      },
    );
  }

  archiveSelected(): void {
    const ids = this.visibleSelection().map((item) => item.id);
    if (!ids.length) return;
    this.run(
      () => this.service.setStatus(ids, ContentStatus.Archived),
      () => {
        this.noticeValue.set(`Đã lưu trữ ${ids.length} mục trong bản mẫu.`);
        this.clearSelectionIds(ids);
      },
    );
  }

  deleteSelected(onDeleted: () => void): void {
    const ids = this.visibleSelection().map((item) => item.id);
    if (!ids.length) return;
    this.run(
      () => this.service.remove(ids),
      () => {
        this.clearSelectionIds(ids);
        this.noticeValue.set('Đã xóa các mục đã chọn khỏi bản mẫu.');
        onDeleted();
      },
    );
  }

  exportCsv(): void {
    this.exporter.download(this.filtered(), this.collectionKey());
    this.noticeValue.set('Đã xuất dữ liệu đang lọc thành CSV minh họa.');
  }

  private run<T>(request: () => Observable<T>, onSuccess: (value: T) => void): void {
    if (this.busy()) return;
    this.busyValue.set(true);
    this.errorValue.set('');
    this.command = defer(request)
      .pipe(
        take(1),
        finalize(() => this.busyValue.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: onSuccess,
        error: (error: unknown) => this.errorValue.set(normalizeApiError(error).message),
      });
  }

  private resetPagination(): void {
    this.pageValue.set(1);
    this.clearSelection();
  }

  private clearSelectionIds(ids: readonly string[]): void {
    const completed = new Set(ids);
    this.selection.update((selected) => new Set([...selected].filter((id) => !completed.has(id))));
  }

  private rememberView(): void {
    if (!this.collection) return;
    this.views.set(this.collection, {
      query: this.query(),
      status: this.status(),
      page: this.currentPage(),
      pageSize: this.pageSize(),
      columns: [...this.visibleColumns()],
    });
  }
}
