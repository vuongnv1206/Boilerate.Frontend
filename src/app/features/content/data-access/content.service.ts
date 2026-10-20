import { Observable } from 'rxjs';
import { CollectionKey, ContentStatus } from '../enums/content.enum';
import type { ContentItem } from '../models/content-item';

/** Feature data boundary. The admin route selects its implementation through DI. */
export abstract class ContentService {
  abstract readonly collectionCounts$: Observable<Readonly<Record<CollectionKey, number>>>;

  abstract getCollection(key: CollectionKey): Observable<readonly ContentItem[]>;
  abstract getById(id: string): Observable<ContentItem | undefined>;
  abstract save(item: ContentItem): Observable<ContentItem>;
  abstract duplicate(id: string): Observable<ContentItem | undefined>;
  abstract setStatus(
    ids: readonly string[],
    status: ContentStatus,
  ): Observable<readonly ContentItem[]>;
  abstract remove(ids: readonly string[]): Observable<void>;
}
