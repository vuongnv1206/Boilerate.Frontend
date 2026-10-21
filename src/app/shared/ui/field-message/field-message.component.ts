import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-field-message',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content />',
  host: {
    '[class.field-help]': 'tone() === "help"',
    '[class.field-error]': 'tone() === "error"',
  },
})
export class FieldMessage {
  readonly tone = input<'help' | 'error'>('help');
}
