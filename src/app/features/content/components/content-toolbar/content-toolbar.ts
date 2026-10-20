import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Popover } from 'primeng/popover';
import { Select } from 'primeng/select';
import { Icon } from '../../../../shared/ui/icon/icon';
import {
  CONTENT_COLUMN_OPTIONS,
  CONTENT_STATUS_OPTIONS,
} from '../../constants/content-toolbar.constants';
import { ContentColumn } from '../../enums/content-table.enum';
import { ContentStatusFilter } from '../../models/content-view.model';

@Component({
  selector: 'app-content-toolbar',
  imports: [FormsModule, Checkbox, InputText, Popover, Select, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './content-toolbar.html',
  styleUrl: './content-toolbar.scss',
})
export class ContentToolbar {
  readonly query = input.required<string>();
  readonly status = input.required<ContentStatusFilter>();
  readonly visibleColumns = input.required<ReadonlySet<ContentColumn>>();
  readonly queryChange = output<string>();
  readonly statusChange = output<ContentStatusFilter>();
  readonly columnToggle = output<ContentColumn>();
  readonly statuses = CONTENT_STATUS_OPTIONS.slice();
  readonly columnOptions = CONTENT_COLUMN_OPTIONS;
}
