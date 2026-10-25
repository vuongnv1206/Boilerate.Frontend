import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { AuthSession } from '@core/auth/auth-session';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { FormField } from '@shared/ui/form-field/form-field.component';
import { StorefrontSettingsStore } from '@stores/storefront-settings.store';

@Component({
  selector: 'app-storefront-settings',
  standalone: true,
  host: { class: 'collection-screen' },
  imports: [
    FormsModule,
    ButtonDirective,
    InputText,
    Textarea,
    ToggleSwitch,
    ContentState,
    FormField,
  ],
  templateUrl: './storefront-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorefrontSettingsComponent implements OnInit {
  readonly store = inject(StorefrontSettingsStore);
  private readonly session = inject(AuthSession);
  readonly canEdit = computed(() => this.session.can('StorefrontSettings', 'Update'));

  ngOnInit(): void {
    this.store.load();
  }

  onText(
    key: 'bankName' | 'accountNumber' | 'accountHolder' | 'branch' | 'instructions',
    event: Event,
  ): void {
    this.store.set(key, (event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }
}
