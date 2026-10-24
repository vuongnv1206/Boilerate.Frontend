import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-form-field" [class.ui-form-field-invalid]="!!error()">
      <label class="ui-form-field-label" [attr.for]="forId()">
        <span>{{ label() }}</span>
        @if (required()) {
          <span class="ui-form-field-required" aria-hidden="true">*</span>
        }
      </label>
      <ng-content />
      @if (hint()) {
        <small class="ui-form-field-hint" [id]="forId() + '-hint'">{{ hint() }}</small>
      }
      @if (error()) {
        <small class="ui-form-field-error" [id]="forId() + '-error'" role="alert">
          {{ error() }}
        </small>
      }
    </div>
  `,
  styleUrl: '../../../../styles/ui/_form-field.scss',
})
export class FormField {
  readonly forId = input.required<string>();
  readonly label = input.required<string>();
  readonly required = input(false);
  readonly hint = input<string | null>(null);
  readonly error = input<string | null>(null);
}
