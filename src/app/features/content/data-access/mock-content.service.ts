import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, defer, distinctUntilChanged, map, of } from 'rxjs';
import {
  CONTENT_LIMITS,
  CollectionKey,
  ContentItem,
  ContentStatus,
  isValidItem,
} from '../models/content-item';
import { createContentFixtures } from './content.fixtures';
import { ContentService } from './content.service';

/** Session-only data implementation for UI development; never persists business data. */
@Injectable()
export class MockContentService extends ContentService {
  private readonly records = new BehaviorSubject<readonly ContentItem[]>(createContentFixtures());

  readonly collectionCounts$ = this.records.pipe(
    map((records) => ({
      products: records.filter((item) => item.collection === 'products').length,
      categories: records.filter((item) => item.collection === 'categories').length,
      types: records.filter((item) => item.collection === 'types').length,
    })),
    distinctUntilChanged(
      (previous, current) =>
        previous.products === current.products &&
        previous.categories === current.categories &&
        previous.types === current.types,
    ),
  );

  getCollection(key: CollectionKey): Observable<readonly ContentItem[]> {
    return this.records.pipe(
      map((records) =>
        records.filter((item) => item.collection === key).map((item) => ({ ...item })),
      ),
    );
  }

  getById(id: string): Observable<ContentItem | undefined> {
    return defer(() => {
      const item = this.records.value.find((record) => record.id === id);
      return of(item ? { ...item } : undefined);
    });
  }

  save(item: ContentItem): Observable<ContentItem> {
    const snapshot = { ...item };
    return defer(() => of(this.persist(snapshot)));
  }

  duplicate(id: string): Observable<ContentItem | undefined> {
    return defer(() => {
      const original = this.records.value.find((record) => record.id === id);
      if (!original) return of(undefined);
      const suffix = ' (bản sao)';
      return of(
        this.persist({
          ...original,
          id: `demo-${crypto.randomUUID()}`,
          name: `${original.name.slice(0, CONTENT_LIMITS.name - suffix.length).trimEnd()}${suffix}`,
          slug: `${original.slug}-copy-${this.records.value.length}`,
          status: 'draft',
        }),
      );
    });
  }

  setStatus(ids: readonly string[], status: ContentStatus): Observable<readonly ContentItem[]> {
    const selected = new Set(ids);
    return defer(() => {
      const updatedAt = new Date().toISOString();
      const updated: ContentItem[] = [];
      this.records.next(
        this.records.value.map((record) => {
          if (!selected.has(record.id)) return record;
          const item = { ...record, status, updatedAt };
          updated.push({ ...item });
          return item;
        }),
      );
      return of(updated);
    });
  }

  remove(ids: readonly string[]): Observable<void> {
    const selected = new Set(ids);
    return defer(() => {
      this.records.next(this.records.value.filter((record) => !selected.has(record.id)));
      return of(undefined);
    });
  }

  private persist(item: ContentItem): ContentItem {
    if (!isValidItem(item)) throw new Error('Nội dung không hợp lệ.');
    const saved = { ...item, name: item.name.trim(), updatedAt: new Date().toISOString() };
    const records = this.records.value;
    this.records.next(
      records.some((record) => record.id === saved.id)
        ? records.map((record) => (record.id === saved.id ? saved : record))
        : [saved, ...records],
    );
    return { ...saved };
  }
}
