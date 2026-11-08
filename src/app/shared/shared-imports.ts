import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  CommonModule,
  CurrencyPipe,
  DatePipe,
  DecimalPipe,
  NgClass,
  NgStyle,
  NgTemplateOutlet,
} from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

// PrimeNG
import { AutoCompleteModule } from 'primeng/autocomplete';
import { BadgeModule } from 'primeng/badge';
import { ButtonDirective, ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { DrawerModule } from 'primeng/drawer';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';

// Shared UI
import { ConfirmDialog } from './ui/confirm-dialog/confirm-dialog.component';
import { ContentState } from './ui/content-state/content-state.component';
import { FieldMessage } from './ui/field-message/field-message.component';
import { FormErrorSummary } from './ui/form-error-summary/form-error-summary.component';
import { FormField } from './ui/form-field/form-field.component';
import { Icon } from './ui/icon/icon.component';
import { StatusBadge } from './ui/status-badge/status-badge.component';

export const SHARED_IMPORTS = [
  CommonModule,
  FormsModule,
  ReactiveFormsModule,
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  CurrencyPipe,
  DatePipe,
  DecimalPipe,
  NgClass,
  NgStyle,
  NgTemplateOutlet,
  CdkTrapFocus,
  // PrimeNG
  AutoCompleteModule,
  TableModule,
  ButtonModule,
  ButtonDirective,
  InputTextModule,
  InputNumberModule,
  InputGroupModule,
  InputGroupAddonModule,
  SelectModule,
  MultiSelectModule,
  CheckboxModule,
  ToggleSwitchModule,
  DatePickerModule,
  TextareaModule,
  DialogModule,
  DrawerModule,
  TabsModule,
  TagModule,
  TooltipModule,
  BadgeModule,
  MessageModule,
  ToastModule,
  // Shared UI
  Icon,
  StatusBadge,
  ContentState,
  ConfirmDialog,
  FormField,
  FieldMessage,
  FormErrorSummary,
] as const;

export {
  ConfirmDialog,
  ContentState,
  FieldMessage,
  FormErrorSummary,
  FormField,
  Icon,
  StatusBadge,
};
