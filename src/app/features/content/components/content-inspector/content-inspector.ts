import { CurrencyPipe, DatePipe } from '@angular/common';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, ElementRef, computed, input, output, viewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Icon } from '@shared/ui/icon/icon';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import { focusWhenVisible } from '@shared/ui/focus-when-visible';
import { STATUS_LABELS } from '../../constants/content.constants';
import { CollectionKey, ContentStatus } from '../../enums/content.enum';
import { ContentForm as ContentFormGroup } from '../../models/content-form.model';
import { ContentItem, collectionDefinition } from '../../models/content-item';

@Component({
  selector: 'app-content-inspector',
  imports: [
    CdkTrapFocus,
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    ToggleSwitch,
    Icon,
    StatusBadge,
  ],
  templateUrl: './content-inspector.html',
  styleUrl: './content-inspector.scss',
})
export class ContentInspector {
  readonly form = input.required<ContentFormGroup>();
  readonly record = input.required<ContentItem>();
  readonly open = input(false);
  readonly modal = input(false);
  readonly closeRequested = output<void>();
  readonly definition = computed(() => collectionDefinition(this.record().collection));
  readonly statusLabels = STATUS_LABELS;
  readonly collectionKey = CollectionKey;
  readonly contentStatus = ContentStatus;
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('inspectorClose');

  focusClose(): void {
    const close = this.closeButton()?.nativeElement;
    focusWhenVisible(close?.closest<HTMLElement>('.inspector') ?? undefined, close, () =>
      this.modal(),
    );
  }
}
