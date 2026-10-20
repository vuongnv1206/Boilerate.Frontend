import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../core/http/api-error';
import { ContentService } from '../data-access/content.service';
import { ContentColumn } from '../enums/content-table.enum';
import { CollectionKey, ContentStatus } from '../enums/content.enum';
import { ContentItem, createContentDraft } from '../models/content-item';
import { ContentExport } from '../services/content-export';
import { ContentViewStore } from './content-view.store';
import { ContentStore } from './content.store';

function record(id: string, collection: CollectionKey = CollectionKey.Products): ContentItem {
  return { ...createContentDraft(collection), id, name: `Đèn ${id}`, slug: `den-${id}` };
}

class ContentServiceStub implements ContentService {
  readonly collectionCounts$ = of({ products: 12, categories: 1, types: 0 });
  readonly collections = {
    products: new BehaviorSubject<readonly ContentItem[]>(
      Array.from({ length: 12 }, (_, index) => record(`${index + 1}`)),
    ),
    categories: new BehaviorSubject<readonly ContentItem[]>([
      record('category-1', CollectionKey.Categories),
    ]),
    types: new BehaviorSubject<readonly ContentItem[]>([]),
  };
  readonly getCollection = vi.fn(
    (key: CollectionKey): Observable<readonly ContentItem[]> => this.collections[key],
  );
  readonly getById = vi.fn<ContentService['getById']>(() => of(undefined));
  readonly save = vi.fn((item: ContentItem) => of(item));
  readonly duplicate = vi.fn<ContentService['duplicate']>(() => of(record('copy')));
  readonly setStatus = vi.fn<ContentService['setStatus']>(() => of([]));
  readonly remove = vi.fn<ContentService['remove']>(() => of(undefined));
}

describe('Content list state', () => {
  let store: ContentStore;
  let service: ContentServiceStub;
  let views: ContentViewStore;
  const download = vi.fn();

  beforeEach(() => {
    service = new ContentServiceStub();
    TestBed.configureTestingModule({
      providers: [
        ContentStore,
        ContentViewStore,
        { provide: ContentService, useValue: service },
        { provide: ContentExport, useValue: { download } },
      ],
    });
    store = TestBed.inject(ContentStore);
    views = TestBed.inject(ContentViewStore);
    download.mockClear();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('cancels an older collection load and does not display its late result', () => {
    const products = new Subject<readonly ContentItem[]>();
    const categories = new Subject<readonly ContentItem[]>();
    service.getCollection.mockImplementation((key) =>
      key === CollectionKey.Products ? products : categories,
    );
    store.connect(CollectionKey.Products);
    expect(store.loading()).toBe(true);
    expect(products.observed).toBe(true);
    store.connect(CollectionKey.Categories);
    expect(products.observed).toBe(false);
    products.next([record('late')]);
    expect(store.collectionItems()).toEqual([]);
    categories.next([record('category-1', CollectionKey.Categories)]);
    expect(store.collectionItems()[0]?.id).toBe('category-1');
    expect(store.loading()).toBe(false);
  });

  it('keeps a load failure recoverable without terminating future loads', () => {
    const firstLoad = new Subject<readonly ContentItem[]>();
    service.getCollection.mockReturnValueOnce(firstLoad);
    store.connect(CollectionKey.Products);
    firstLoad.error(
      new ApiError({
        status: 0,
        kind: 'network',
        message: 'Không thể kết nối máy chủ.',
        fieldErrors: {},
      }),
    );
    expect(store.loading()).toBe(false);
    expect(store.error()).toContain('kết nối');
    store.retry();
    expect(store.error()).toBe('');
    expect(store.collectionItems()).toHaveLength(12);
  });

  it('combines search with page selection and clears selection when filtering', () => {
    store.connect(CollectionKey.Products);
    expect(store.pageItems()).toHaveLength(10);
    store.toggleAll();
    expect(store.visibleSelection()).toHaveLength(10);
    store.setPage(2);
    store.toggleAll();
    expect(store.visibleSelection()).toHaveLength(12);
    expect(store.rangeStart()).toBe(11);
    expect(store.rangeEnd()).toBe(12);
    store.setQuery('den 12');
    expect(store.currentPage()).toBe(1);
    expect(store.filtered().map((item) => item.id)).toEqual(['12']);
    expect(store.visibleSelection()).toEqual([]);
    store.setStatus(ContentStatus.Published);
    expect(store.filtered()).toEqual([]);
    store.resetFilters();
    expect(store.filtered()).toHaveLength(12);
  });

  it('restores per-collection filters, page and columns across navigation', () => {
    store.connect(CollectionKey.Products);
    store.setPage(2);
    store.toggleColumn(ContentColumn.Price);
    store.connect(CollectionKey.Categories);
    store.setQuery(ContentColumn.Category);
    store.connect(CollectionKey.Products);
    expect(store.currentPage()).toBe(2);
    expect(store.visibleColumns().has(ContentColumn.Price)).toBe(false);
    expect(store.query()).toBe('');
    expect(views.get(CollectionKey.Categories).query).toBe(ContentColumn.Category);
  });

  it('prevents repeated mutations and preserves selection when deletion fails', () => {
    const removal = new Subject<void>();
    const deleted = vi.fn();
    service.remove.mockReturnValue(removal);
    store.connect(CollectionKey.Products);
    store.toggleItem('1');
    store.deleteSelected(deleted);
    store.deleteSelected(deleted);
    expect(store.busy()).toBe(true);
    expect(service.remove).toHaveBeenCalledExactlyOnceWith(['1']);
    removal.error(
      new ApiError({
        status: 500,
        kind: 'server',
        message: 'Máy chủ chưa thể xử lý yêu cầu.',
        fieldErrors: {},
      }),
    );
    expect(store.busy()).toBe(false);
    expect(store.visibleSelection()).toHaveLength(1);
    expect(deleted).not.toHaveBeenCalled();
    expect(store.error()).toContain('Máy chủ');
    service.remove.mockReturnValue(of(undefined));
    store.deleteSelected(deleted);
    expect(deleted).toHaveBeenCalledOnce();
    expect(store.visibleSelection()).toHaveLength(0);
    expect(store.notice()).toContain('Đã xóa');
  });

  it('removes vanished records from selection and clamps pagination', () => {
    store.connect(CollectionKey.Products);
    store.setPage(2);
    store.toggleItem('12');
    service.collections.products.next([record('1')]);
    expect(store.visibleSelection()).toEqual([]);
    expect(store.selectedIds().size).toBe(0);
    expect(store.currentPage()).toBe(1);
  });

  it('only clears the selection submitted to a completed asynchronous mutation', () => {
    const update = new Subject<readonly ContentItem[]>();
    service.setStatus.mockReturnValue(update);
    store.connect(CollectionKey.Products);
    store.toggleItem('1');
    store.archiveSelected();
    store.toggleItem('2');
    update.next([record('1')]);
    expect(store.busy()).toBe(false);
    expect(store.selectedIds()).toEqual(new Set(['2']));
    expect(store.notice()).toContain('1 mục');
  });

  it('exports the current filtered view rather than only the visible page', () => {
    store.connect(CollectionKey.Products);
    store.setPage(2);
    store.exportCsv();
    expect(download).toHaveBeenCalledExactlyOnceWith(store.filtered(), CollectionKey.Products);
    expect(download.mock.calls[0]?.[0]).toHaveLength(12);
  });

  it('tears down loads and commands with the page lifecycle and remembers its view', () => {
    const removal = new Subject<void>();
    service.remove.mockReturnValue(removal);
    store.connect(CollectionKey.Products);
    store.setQuery('den');
    store.toggleItem('1');
    store.deleteSelected(vi.fn());
    expect(service.collections.products.observed).toBe(true);
    TestBed.resetTestingModule();
    expect(service.collections.products.observed).toBe(false);
    expect(removal.observed).toBe(false);
    expect(views.get(CollectionKey.Products).query).toBe('den');
  });
});
