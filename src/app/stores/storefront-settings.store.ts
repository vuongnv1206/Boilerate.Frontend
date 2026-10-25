import { Injectable, inject, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { StorefrontSettings, UpdateStorefrontSettings } from '@models/storefront-settings.dto';
import { StorefrontSettingsService } from '@services/storefront-settings.service';

type EditableSetting = Exclude<keyof UpdateStorefrontSettings, 'version'>;

@Injectable({ providedIn: 'root' })
export class StorefrontSettingsStore {
  private readonly service = inject(StorefrontSettingsService);
  private readonly settingsState = signal<StorefrontSettings | null>(null);
  private readonly draftState = signal<UpdateStorefrontSettings | null>(null);
  private readonly loadingState = signal(false);
  private readonly savingState = signal(false);
  private readonly errorState = signal('');
  private readonly noticeState = signal('');

  readonly settings = this.settingsState.asReadonly();
  readonly draft = this.draftState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly notice = this.noticeState.asReadonly();

  load() {
    this.loadingState.set(true);
    this.errorState.set('');
    this.service
      .get()
      .pipe(
        tap((settings) => {
          this.settingsState.set(settings);
          this.draftState.set({ ...settings });
          this.loadingState.set(false);
        }),
        catchError((error: unknown) => {
          this.errorState.set(normalizeApiError(error).message);
          this.loadingState.set(false);
          return of(null);
        }),
      )
      .subscribe();
  }

  set<K extends EditableSetting>(key: K, value: UpdateStorefrontSettings[K]) {
    const current = this.draftState();
    if (!current) return;
    this.draftState.set({ ...current, [key]: value });
    this.noticeState.set('');
  }

  save() {
    const draft = this.draftState();
    if (!draft || this.savingState()) return;
    this.savingState.set(true);
    this.errorState.set('');
    this.noticeState.set('');
    this.service
      .update(draft)
      .pipe(
        tap((settings) => {
          this.settingsState.set(settings);
          this.draftState.set({ ...settings });
          this.noticeState.set('Đã lưu thông tin thanh toán.');
          this.savingState.set(false);
        }),
        catchError((error: unknown) => {
          this.errorState.set(normalizeApiError(error).message);
          this.savingState.set(false);
          return of(null);
        }),
      )
      .subscribe();
  }
}
