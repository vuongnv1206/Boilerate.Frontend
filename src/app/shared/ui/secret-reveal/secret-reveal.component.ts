import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Icon } from '../icon/icon.component';

@Component({
  selector: 'ui-secret-reveal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, Icon],
  styleUrl: '../../../../styles/ui/_secret-reveal.scss',
  template: `
    <div class="ui-secret-box">
      <div class="ui-secret-header">
        <span class="ui-secret-label">{{ label() }}</span>
        <div class="ui-secret-actions">
          @if (value() !== null) {
            <button
              pButton
              type="button"
              size="small"
              severity="secondary"
              outlined
              (click)="copyValue()"
              [attr.aria-label]="'Sao chép ' + label()"
            >
              <ui-icon [name]="copied() ? 'check' : 'copy'" [size]="14" />
              <span>{{ copied() ? 'Đã chép' : 'Sao chép' }}</span>
            </button>
            <button
              pButton
              type="button"
              size="small"
              severity="secondary"
              outlined
              (click)="hideRequested.emit()"
            >
              <ui-icon name="eye-off" [size]="14" />
              <span>{{ hideLabel() }}</span>
            </button>
          } @else if (canReveal()) {
            <button
              pButton
              type="button"
              size="small"
              severity="secondary"
              outlined
              [disabled]="loading()"
              (click)="revealRequested.emit()"
            >
              <ui-icon name="eye" [size]="14" />
              <span>{{ loading() ? 'Đang mở…' : revealLabel() }}</span>
            </button>
          }
        </div>
      </div>
      @if (value() !== null) {
        <pre class="ui-secret-value">{{ value() }}</pre>
      } @else {
        <span class="ui-secret-mask" aria-label="Nội dung đang ẩn">••••••••••••</span>
      }
    </div>
  `,
})
export class SecretReveal {
  readonly label = input('Nội dung bảo mật');
  readonly value = input<string | null>(null);
  readonly loading = input(false);
  readonly canReveal = input(true);
  readonly revealLabel = input('Hiện nội dung');
  readonly hideLabel = input('Ẩn');
  readonly revealRequested = output<void>();
  readonly hideRequested = output<void>();
  readonly copied = signal(false);
  private copyTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    destroyRef: DestroyRef,
  ) {
    destroyRef.onDestroy(() => {
      if (this.copyTimer !== undefined) clearTimeout(this.copyTimer);
      if (this.value() !== null) this.hideRequested.emit();
    });
  }

  copyValue(): void {
    const content = this.value();
    if (!content) return;
    void this.document.defaultView?.navigator.clipboard?.writeText(content).then(() => {
      this.copied.set(true);
      if (this.copyTimer !== undefined) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => this.copied.set(false), 1800);
    });
  }
}
