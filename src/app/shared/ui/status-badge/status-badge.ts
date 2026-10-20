import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content />',
  styleUrl: './status-badge.scss',
  host: { class: 'status-badge', '[attr.data-tone]': 'tone()' },
})
export class StatusBadge {
  readonly tone = input<'neutral' | 'success' | 'warning' | 'muted'>('neutral');
}
