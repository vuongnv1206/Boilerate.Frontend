import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { WorkspaceNavigation } from '../../../core/navigation/workspace-navigation';
import { ContentService } from '../data-access/content.service';
import { COLLECTIONS } from '../constants/content.constants';

/** Adapts feature data to the shell's presentation contract. */
@Injectable()
export class ContentNavigation implements WorkspaceNavigation {
  private readonly counts = toSignal(inject(ContentService).collectionCounts$, {
    initialValue: { products: 0, categories: 0, types: 0 },
  });

  readonly collections = computed(() =>
    COLLECTIONS.map((collection) => ({
      key: collection.key,
      label: collection.label,
      icon: collection.icon,
      path: `/admin/collections/${collection.key}`,
      count: this.counts()[collection.key],
    })),
  );
}
