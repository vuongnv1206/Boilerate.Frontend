import { Injectable } from '@angular/core';
import {
  CONTENT_DEFAULT_COLUMNS,
  CONTENT_DEFAULT_PAGE_SIZE,
} from '../constants/content-table.constants';
import { CONTENT_ALL_STATUSES } from '../constants/content-toolbar.constants';
import { CollectionKey } from '../enums/content.enum';
import { ListViewState } from '../models/content-item';

/** Navigation-session preferences; content records are owned by ContentService. */
@Injectable()
export class ContentViewStore {
  private readonly views = new Map<CollectionKey, ListViewState>();

  get(key: CollectionKey): ListViewState {
    const view = this.views.get(key) ?? {
      query: '',
      status: CONTENT_ALL_STATUSES,
      page: 1,
      pageSize: CONTENT_DEFAULT_PAGE_SIZE,
      columns: [...CONTENT_DEFAULT_COLUMNS],
    };
    return { ...view, columns: [...view.columns] };
  }

  set(key: CollectionKey, view: ListViewState): void {
    this.views.set(key, { ...view, columns: [...view.columns] });
  }
}
