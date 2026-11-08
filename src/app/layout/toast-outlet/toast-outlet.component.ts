import { Component } from '@angular/core';
import { ToastService } from '@core/feedback/toast.service';
import { Icon } from '@shared/ui/icon/icon.component';

@Component({
  selector: 'app-toast-outlet',
  imports: [Icon],
  styleUrl: '../../../styles/ui/_toast.scss',
  template: `
    @if (toast.items().length) {
      <div class="app-toast-region" role="status" aria-live="polite">
        @for (item of toast.items(); track item.id) {
          <div class="app-toast-card" [attr.data-tone]="item.tone">
            <span>{{ item.message }}</span>
            <button
              type="button"
              class="app-toast-close"
              aria-label="Đóng thông báo"
              (click)="toast.dismiss(item.id)"
            >
              <ui-icon name="x" [size]="14" />
            </button>
          </div>
        }
      </div>
    }
  `,
})
export class ToastOutlet {
  constructor(public readonly toast: ToastService) {}
}
