import { Component, computed, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { FieldMessage } from '@shared/ui/field-message/field-message';
import { Icon } from '@shared/ui/icon/icon';
import {
  CONTENT_EDITOR_CATEGORIES,
  CONTENT_EDITOR_IMAGES,
} from '../../constants/content-editor.constants';
import { CONTENT_LIMITS } from '../../constants/content.constants';
import { CollectionKey, ContentStatus, ContentTab } from '../../enums/content.enum';
import { ContentForm as ContentFormGroup } from '../../models/content-form.model';
import { ContentItem, collectionDefinition } from '../../models/content-item';

@Component({
  selector: 'app-content-form',
  imports: [ReactiveFormsModule, InputNumber, InputText, Select, Textarea, FieldMessage, Icon],
  host: { class: 'editor-main' },
  templateUrl: './content-form.html',
  styleUrl: './content-form.scss',
})
export class ContentForm {
  readonly form = input.required<ContentFormGroup>();
  readonly record = input.required<ContentItem>();
  readonly activeTab = input<ContentTab>(ContentTab.Details);
  readonly tabChange = output<ContentTab>();
  readonly save = output<void>();
  readonly imageChange = output<string>();
  readonly definition = computed(() => collectionDefinition(this.record().collection));
  readonly limits = CONTENT_LIMITS;
  readonly collectionKey = CollectionKey;
  readonly contentStatus = ContentStatus;
  readonly contentTab = ContentTab;
  // PrimeNG Select declares a mutable options input; retain a local copy of shared readonly options.
  readonly categories = [...CONTENT_EDITOR_CATEGORIES];
  readonly images = CONTENT_EDITOR_IMAGES;

  invalid(field: keyof ContentFormGroup['controls']): boolean {
    const control = this.form().controls[field];
    return control.invalid && (control.touched || control.dirty);
  }
}
