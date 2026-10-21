import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-form-error-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (messages().length) {
    <div class="editor-error" role="alert">
      <ul>
        @for (message of messages(); track $index) {
          <li>{{ message }}</li>
        }
      </ul>
    </div>
  }`,
})
export class FormErrorSummary {
  readonly messages = input<readonly string[]>([]);
}
