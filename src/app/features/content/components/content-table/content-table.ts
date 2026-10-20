import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Checkbox } from 'primeng/checkbox';
import { Popover } from 'primeng/popover';
import { ContentState } from '../../../../shared/ui/content-state/content-state';
import { Icon } from '../../../../shared/ui/icon/icon';
import { StatusBadge } from '../../../../shared/ui/status-badge/status-badge';
import { STATUS_LABELS } from '../../constants/content.constants';
import { CONTENT_PAGE_SIZES } from '../../constants/content-table.constants';
import { ContentColumn } from '../../enums/content-table.enum';
import { CollectionKey, ContentStatus } from '../../enums/content.enum';
import { CollectionDefinition, ContentItem } from '../../models/content-item';

@Component({
  selector: 'app-content-table',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    RouterLink,
    Checkbox,
    Popover,
    ContentState,
    Icon,
    StatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './content-table.html',
  styleUrl: './content-table.scss',
})
export class ContentTable {
  readonly definition = input.required<CollectionDefinition>();
  readonly pageItems = input.required<readonly ContentItem[]>();
  readonly visibleColumns = input.required<ReadonlySet<ContentColumn>>();
  readonly selectedIds = input.required<ReadonlySet<string>>();
  readonly allPageSelected = input.required<boolean>();
  readonly rangeStart = input.required<number>();
  readonly rangeEnd = input.required<number>();
  readonly total = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly currentPage = input.required<number>();
  readonly pageCount = input.required<number>();
  readonly busy = input(false);
  readonly itemOpen = output<ContentItem>();
  readonly itemToggle = output<string>();
  readonly toggleAll = output<void>();
  readonly filtersReset = output<void>();
  readonly itemDuplicate = output<ContentItem>();
  readonly itemArchive = output<ContentItem>();
  readonly pageSizeChange = output<number>();
  readonly pageChange = output<number>();
  readonly menuItem = signal<ContentItem | null>(null);
  readonly statusLabels = STATUS_LABELS;
  readonly columns = ContentColumn;
  readonly collectionKeys = CollectionKey;
  readonly contentStatuses = ContentStatus;
  readonly pageSizes = CONTENT_PAGE_SIZES;

  openMenuItem(): void {
    const item = this.menuItem();
    if (item) this.itemOpen.emit(item);
  }

  duplicateMenuItem(): void {
    const item = this.menuItem();
    if (item) this.itemDuplicate.emit(item);
  }

  archiveMenuItem(): void {
    const item = this.menuItem();
    if (item) this.itemArchive.emit(item);
  }
}
