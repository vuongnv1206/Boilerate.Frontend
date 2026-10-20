import { Injectable, computed, inject } from '@angular/core';
import { WorkspaceNavigation } from '../../core/navigation/workspace-navigation';
import { COLLECTIONS } from './content-model';
import { DemoContentStore } from './demo-content-store';

@Injectable({ providedIn: 'root' })
export class ContentWorkspaceNavigation implements WorkspaceNavigation {
  private readonly store = inject(DemoContentStore);

  readonly collections = computed(() =>
    COLLECTIONS.map((collection) => ({
      key: collection.key,
      label: collection.label,
      icon: collection.icon,
      path: `/admin/collections/${collection.key}`,
      count: this.store.collection(collection.key).length,
    })),
  );
}
