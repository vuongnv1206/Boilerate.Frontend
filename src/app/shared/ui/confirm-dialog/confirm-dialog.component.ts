import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Dialog } from 'primeng/dialog';

@Component({
  selector: 'ui-confirm-dialog',
  imports: [Dialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p-dialog
    [header]="title()"
    [visible]="visible()"
    (visibleChange)="!$event && answered.emit(false)"
    [modal]="true"
    [draggable]="false"
    [resizable]="false"
    [style]="{ width: '410px', maxWidth: '92vw' }"
    ><p class="collection-dialog-copy">
      Thay đổi của anh chưa được lưu. Rời khỏi màn hình sẽ bỏ các thay đổi này.
    </p>
    <ng-template #footer
      ><button class="ui-button" (click)="answered.emit(false)">Ở lại</button
      ><button class="ui-button danger" (click)="answered.emit(true)">
        Bỏ thay đổi
      </button></ng-template
    ></p-dialog
  >`,
})
export class ConfirmDialog {
  readonly visible = input.required<boolean>();
  readonly title = input.required<string>();
  readonly answered = output<boolean>();
}
