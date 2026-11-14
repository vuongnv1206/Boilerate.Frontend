import { Component, computed, input, output, signal } from '@angular/core';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import {
  OVERVIEW_WORK_DESCRIPTIONS,
  OVERVIEW_WORK_LABELS,
  OverviewSection,
  OverviewWork,
  OverviewWorkGroup,
  OverviewWorkItem,
  OverviewWorkKey,
} from '@api/overview/models/overview.dto';
import { getOverviewWorkStatusLabel } from '@api/overview/models/overview.util';

@Component({
  selector: 'app-overview-work-panel',
  host: { style: 'display: contents' },
  imports: [SHARED_IMPORTS],
  templateUrl: './overview-work-panel.component.html',
})
export class OverviewWorkPanelComponent {
  // System variables
  readonly section = input.required<OverviewSection<OverviewWork>>();
  readonly groups = input.required<readonly OverviewWorkGroup[]>();
  readonly reloadRequested = output<void>();

  // Business variables
  readonly workLabels = OVERVIEW_WORK_LABELS;
  readonly workDescriptions = OVERVIEW_WORK_DESCRIPTIONS;
  readonly selectedWorkKey = signal<OverviewWorkKey | null>(null);

  readonly selectedWork = computed(
    () =>
      this.groups().find((group) => group.key === this.selectedWorkKey()) ??
      this.groups()[0] ??
      null,
  );

  readonly selectedWorkItems = computed(() => [...(this.selectedWork()?.items ?? [])]);

  selectGroup(key: OverviewWorkKey): void {
    this.selectedWorkKey.set(key);
  }

  requestReload(): void {
    this.reloadRequested.emit();
  }

  workListPath(group: OverviewWorkGroup): string {
    return group.kind === 'order' ? '/admin/orders' : '/admin/renewals';
  }

  workQueue(group: OverviewWorkGroup): string {
    return group.key.startsWith('renewal-') ? group.key.slice('renewal-'.length) : group.key;
  }

  workItemPath(group: OverviewWorkGroup, item: OverviewWorkItem): string[] {
    return [group.kind === 'order' ? '/admin/orders' : '/admin/renewals', item.id];
  }

  workStatus(group: OverviewWorkGroup, item: OverviewWorkItem): string {
    return getOverviewWorkStatusLabel(group, item);
  }
}
