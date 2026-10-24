import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';

@Component({
  selector: 'ui-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Tag],
  template: '<p-tag class="status-tag" [severity]="severity()"><ng-content /></p-tag>',
  styleUrl: '../../../../styles/ui/_status-badge.scss',
  host: { class: 'status-badge' },
})
export class StatusBadge {
  readonly tone = input<'neutral' | 'success' | 'warning' | 'muted'>('neutral');
  readonly severity = computed(() => {
    switch (this.tone()) {
      case 'success':
        return 'success';
      case 'warning':
        return 'warn';
      default:
        return 'secondary';
    }
  });
}
