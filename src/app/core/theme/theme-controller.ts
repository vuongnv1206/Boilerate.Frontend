import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'boilerate.ui.theme';

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

@Injectable({ providedIn: 'root' })
export class ThemeController {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly preference = signal<ThemeMode>('system');
  private readonly systemDark = signal(false);
  private initialized = false;

  readonly mode = this.preference.asReadonly();
  readonly resolved = computed<ResolvedTheme>(() =>
    this.preference() === 'system'
      ? this.systemDark()
        ? 'dark'
        : 'light'
      : (this.preference() as ResolvedTheme),
  );

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    const browser = this.document.defaultView;
    if (!browser) return;
    const media = browser.matchMedia?.('(prefers-color-scheme: dark)');
    this.systemDark.set(media?.matches ?? false);
    try {
      const stored = browser.localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemeMode(stored)) this.preference.set(stored);
    } catch {
      // Storage can be blocked; appearance remains available in memory.
    }
    this.apply();
    const onSystemChange = (event: MediaQueryListEvent): void => {
      this.systemDark.set(event.matches);
      if (this.mode() === 'system') this.apply();
    };
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== THEME_STORAGE_KEY) return;
      this.preference.set(isThemeMode(event.newValue) ? event.newValue : 'system');
      this.apply();
    };
    media?.addEventListener('change', onSystemChange);
    browser.addEventListener('storage', onStorage);
    this.destroyRef.onDestroy(() => {
      media?.removeEventListener('change', onSystemChange);
      browser.removeEventListener('storage', onStorage);
    });
  }

  setMode(mode: ThemeMode): void {
    this.preference.set(mode);
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Keep the current selection even if persistence is unavailable.
    }
    this.apply();
  }

  private apply(): void {
    const root = this.document.documentElement;
    const theme = this.resolved();
    root.dataset['theme'] = theme;
    root.classList.toggle('app-dark', theme === 'dark');
    root.style.colorScheme = theme;
    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#1b1b1d' : '#f7f7f8');
  }
}
