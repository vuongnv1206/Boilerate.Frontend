import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon } from '../icon/icon';

export type ContentStateKind = 'empty' | 'loading' | 'error';

@Component({
  selector: 'ui-content-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './content-state.html',
  styleUrl: './content-state.scss',
  host: {
    '[class.page]': 'layout() === "page"',
    '[attr.role]': 'kind() === "error" ? "alert" : kind() === "loading" ? "status" : null',
    '[attr.aria-busy]': 'kind() === "loading" ? "true" : null',
  },
})
export class ContentState {
  readonly kind = input<ContentStateKind>('empty');
  readonly title = input.required<string>();
  readonly message = input('');
  readonly icon = input('search');
  readonly layout = input<'table' | 'page'>('table');
  readonly resolvedIcon = computed(() => (this.kind() === 'error' ? 'alert' : this.icon()));
}
