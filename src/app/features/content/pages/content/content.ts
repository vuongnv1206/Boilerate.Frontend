import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { Dialog } from 'primeng/dialog';
import { ContentState } from '../../../../shared/ui/content-state/content-state';
import { Icon } from '../../../../shared/ui/icon/icon';
import { ContentTable } from '../../components/content-table/content-table';
import { ContentToolbar } from '../../components/content-toolbar/content-toolbar';
import { collectionDefinition, ContentItem } from '../../models/content-item';
import { ContentStore } from '../../state/content.store';
import { ContentExport } from '../../services/content-export';

@Component({
  selector: 'app-content',
  imports: [RouterLink, Dialog, Icon, ContentState, ContentToolbar, ContentTable],
  providers: [ContentStore, ContentExport],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './content.html',
  styleUrl: './content.scss',
})
export class Content {
  readonly store = inject(ContentStore);
  private readonly router = inject(Router);
  readonly deleteOpen = signal(false);

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(
        map((params) => collectionDefinition(params.get('collection')).key),
        distinctUntilChanged(),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((key) => {
        this.deleteOpen.set(false);
        this.store.connect(key);
      });
  }

  open(item: ContentItem): void {
    void this.router.navigate(['/admin/items', item.id]);
  }

  deleteSelected(): void {
    this.store.deleteSelected(() => this.deleteOpen.set(false));
  }
}
