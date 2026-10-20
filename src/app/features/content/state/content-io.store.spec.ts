import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentService } from '../data-access/content.service';
import { ContentItem, createContentDraft } from '../models/content-item';
import { CollectionKey, ContentStatus, ContentSaveState } from '../enums/content.enum';
import { ContentIoStore } from './content-io.store';

function record(id = 'record-1', status: ContentStatus = ContentStatus.Draft): ContentItem {
  return {
    ...createContentDraft(CollectionKey.Products),
    id,
    name: 'Nội dung ban đầu',
    slug: 'noi-dung-ban-dau',
    status,
  };
}

function setup(item = record()) {
  const savedRecords = new Map([[item.id, item]]);
  const service = {
    collectionCounts$: of({ products: 1, categories: 0, types: 0 }),
    getCollection: vi.fn(() => of([...savedRecords.values()])),
    getById: vi.fn((id: string): Observable<ContentItem | undefined> => of(savedRecords.get(id))),
    save: vi.fn((value: ContentItem): Observable<ContentItem> => {
      const saved = { ...value, name: value.name.trim(), updatedAt: '2026-10-20T12:00:00.000Z' };
      savedRecords.set(value.id, saved);
      return of(saved);
    }),
    duplicate: vi.fn(() => of(undefined)),
    setStatus: vi.fn(
      (ids: readonly string[], status: ContentStatus): Observable<readonly ContentItem[]> => {
        const values = ids.flatMap((id) => {
          const existing = savedRecords.get(id);
          return existing ? [{ ...existing, status, updatedAt: '2026-10-20T13:00:00.000Z' }] : [];
        });
        values.forEach((value) => savedRecords.set(value.id, value));
        return of(values);
      },
    ),
    remove: vi.fn(() => of(undefined)),
  } satisfies ContentService;
  TestBed.configureTestingModule({
    providers: [ContentIoStore, { provide: ContentService, useValue: service }],
  });
  const store = TestBed.inject(ContentIoStore);
  store.load(item.id, CollectionKey.Products);
  const edit = (value: string) => {
    store.form.controls.name.setValue(value);
    store.form.markAsDirty();
  };
  return { store, service, savedRecords, edit };
}

afterEach(() => {
  TestBed.resetTestingModule();
  vi.useRealTimers();
});

describe('ContentIoStore lifecycle', () => {
  it('debounces valid draft changes and preserves a manually entered new-item slug', () => {
    vi.useFakeTimers();
    const { store, service, edit } = setup();
    edit('Tên bản nháp mới');
    vi.advanceTimersByTime(699);
    expect(service.save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(service.save).toHaveBeenCalledTimes(1);
    expect(store.form.pristine).toBe(true);
    store.load('new', CollectionKey.Products);
    edit('Đèn mới');
    expect(store.form.controls.slug.value).toBe('den-moi');
    store.form.controls.slug.setValue('custom-slug');
    vi.advanceTimersByTime(700);
    edit('Đèn phiên bản mới');
    expect(store.form.controls.slug.value).toBe('custom-slug');
  });

  it('requires explicit save for published records and trims canonical values', async () => {
    vi.useFakeTimers();
    const { store, service, edit } = setup(record('record-1', ContentStatus.Published));
    edit('  Nội dung đã sửa  ');
    vi.advanceTimersByTime(1000);
    expect(service.save).not.toHaveBeenCalled();
    expect(await store.save()).toBe(true);
    expect(store.form.controls.name.value).toBe('Nội dung đã sửa');
    expect(store.form.pristine).toBe(true);
    expect(store.notice()).toContain('bản mẫu');
  });

  it('blocks invalid forms before they reach the data service', async () => {
    vi.useFakeTimers();
    const { store, service, edit } = setup();
    edit(' \t\n ');
    vi.advanceTimersByTime(1000);
    expect(await store.save()).toBe(false);
    expect(store.invalid('name')).toBe(true);
    expect(store.saveState()).toBe(ContentSaveState.Invalid);
    expect(service.save).not.toHaveBeenCalled();
  });

  it('cancels a previous load and ignores its late response when the route changes', () => {
    const { store, service } = setup();
    const first = new Subject<ContentItem | undefined>();
    const second = new Subject<ContentItem | undefined>();
    service.getById.mockReturnValueOnce(first).mockReturnValueOnce(second);
    store.load('first', CollectionKey.Products);
    expect(store.loading()).toBe(true);
    store.load('second', CollectionKey.Products);
    expect(first.observed).toBe(false);
    second.next(record('second'));
    first.next(record('first'));
    expect(store.item()?.id).toBe('second');
    expect(store.loading()).toBe(false);
  });

  it('distinguishes failed loading from a missing record and allows retry', () => {
    const { store, service } = setup();
    service.getById.mockReturnValueOnce(throwError(() => new Error('offline')));
    store.load('record-1', CollectionKey.Products);
    expect(store.loadError()).toContain('Không tải được');
    expect(store.notFound()).toBe(false);
    store.load('missing', CollectionKey.Products);
    expect(store.loadError()).toBe('');
    expect(store.notFound()).toBe(true);
    store.load('record-1', CollectionKey.Products);
    expect(store.item()?.id).toBe('record-1');
  });

  it('retains dirty values after a failed save and only marks saved after retry succeeds', async () => {
    const { store, service, edit } = setup(record('record-1', ContentStatus.Published));
    edit('Giữ nội dung này');
    service.save.mockReturnValueOnce(throwError(() => new Error('offline')));
    expect(await store.save()).toBe(false);
    expect(store.form.dirty).toBe(true);
    expect(store.form.controls.name.value).toBe('Giữ nội dung này');
    expect(store.mutationError()).toBe(true);
    expect(store.notice()).toContain('thử lại');
    expect(await store.save()).toBe(true);
    expect(store.form.pristine).toBe(true);
    expect(store.mutationError()).toBe(false);
  });

  it('does not overwrite new edits or mark them pristine when an earlier request finishes', async () => {
    const { store, service, edit } = setup(record('record-1', ContentStatus.Published));
    const response = new Subject<ContentItem>();
    service.save.mockReturnValueOnce(response);
    edit('Phiên bản gửi đi');
    const saved = store.save();
    expect(store.busy()).toBe(true);
    edit('Phiên bản mới hơn');
    store.setImage('lamp');
    response.next({ ...record('record-1', ContentStatus.Published), name: 'Phiên bản gửi đi' });
    expect(await saved).toBe(true);
    expect(store.busy()).toBe(false);
    expect(store.form.controls.name.value).toBe('Phiên bản mới hơn');
    expect(store.item()?.image).toBe('/images/lamp.svg');
    expect(store.form.dirty).toBe(true);
    expect(store.saveState()).toBe(ContentSaveState.Pending);
  });

  it('serializes repeated saves and flushes newer changes without overlapping writes', async () => {
    const { store, service, edit } = setup(record('record-1', ContentStatus.Published));
    const response = new Subject<ContentItem>();
    service.save.mockReturnValueOnce(response);
    edit('Phiên bản gửi đi');
    const first = store.save();
    edit('Phiên bản tiếp theo');
    const second = store.save();
    expect(service.save).toHaveBeenCalledTimes(1);
    response.next({ ...record('record-1', ContentStatus.Published), name: 'Phiên bản gửi đi' });
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(service.save).toHaveBeenCalledTimes(2);
    expect(store.form.controls.name.value).toBe('Phiên bản tiếp theo');
    expect(store.form.pristine).toBe(true);
  });

  it('cancels a pending write on route replacement and prevents its response changing the new form', async () => {
    const { store, service, edit } = setup(record('record-1', ContentStatus.Published));
    const response = new Subject<ContentItem>();
    service.save.mockReturnValueOnce(response);
    edit('Nội dung cũ');
    const result = store.save();
    store.load('new', CollectionKey.Categories);
    expect(await result).toBe(false);
    expect(response.observed).toBe(false);
    response.next(record('record-1'));
    expect(store.item()?.collection).toBe(CollectionKey.Categories);
    expect(store.form.controls.name.value).toBe('');
    expect(store.busy()).toBe(false);
  });

  it('uses canonical status and timestamp and reports status failures without claiming publication', async () => {
    const { store, service } = setup();
    expect(await store.publish()).toBe(true);
    expect(store.item()?.status).toBe(ContentStatus.Published);
    expect(store.item()?.updatedAt).toBe('2026-10-20T13:00:00.000Z');
    service.setStatus.mockReturnValueOnce(throwError(() => new Error('offline')));
    expect(await store.restoreDraft()).toBe(false);
    expect(store.item()?.status).toBe(ContentStatus.Published);
    expect(store.mutationError()).toBe(true);
  });

  it('destroys pending timers and subscriptions with its page scope', async () => {
    vi.useFakeTimers();
    const { store, service, edit } = setup();
    const response = new Subject<ContentItem>();
    service.save.mockReturnValueOnce(response);
    edit('Nội dung chưa hoàn tất');
    const result = store.save();
    TestBed.resetTestingModule();
    expect(await result).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(service.save).toHaveBeenCalledTimes(1);
    expect(response.observed).toBe(false);
  });
});
