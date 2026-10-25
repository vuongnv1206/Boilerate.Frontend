import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';

@Component({
  selector: 'ui-confirm-dialog',
  imports: [Dialog, ButtonDirective],
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
      {{ message() }}
    </p>
    <ng-template #footer
      ><button pButton type="button" severity="secondary" outlined (click)="answered.emit(false)">
        Ở lại</button
      ><button pButton type="button" severity="danger" (click)="answered.emit(true)">
        Bỏ thay đổi
      </button></ng-template
    ></p-dialog
  >`,
})
export class ConfirmDialog {
  readonly visible = input.required<boolean>();
  readonly title = input.required<string>();
  readonly message = input(
    'Thay đổi của anh chưa được lưu. Rời khỏi màn hình sẽ bỏ các thay đổi này.',
  );
  readonly answered = output<boolean>();
}
