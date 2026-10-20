import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, ThemeController } from './theme-controller';

describe('ThemeController', () => {
  let systemChange: ((event: MediaQueryListEvent) => void) | undefined;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    localStorage.clear();
    systemChange = undefined;
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          systemChange = listener;
        },
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.classList.remove('app-dark');
    document.documentElement.dataset['theme'] = 'light';
    document.documentElement.style.colorScheme = 'light';
  });

  it('restores the saved dark mode and applies it to root overlays', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const theme = TestBed.inject(ThemeController);
    theme.initialize();
    expect(theme.mode()).toBe('dark');
    expect(theme.resolved()).toBe('dark');
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('follows OS changes only when system mode is selected', () => {
    const theme = TestBed.inject(ThemeController);
    theme.initialize();
    systemChange?.({ matches: true } as MediaQueryListEvent);
    expect(theme.resolved()).toBe('dark');
    theme.setMode('light');
    systemChange?.({ matches: true } as MediaQueryListEvent);
    expect(theme.resolved()).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('synchronizes another tab and falls back to system for a cleared preference', () => {
    const theme = TestBed.inject(ThemeController);
    theme.initialize();
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'dark' }));
    expect(theme.mode()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: null }));
    expect(theme.mode()).toBe('system');
    expect(theme.resolved()).toBe('light');
  });

  it('keeps appearance functional when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    const theme = TestBed.inject(ThemeController);
    expect(() => theme.initialize()).not.toThrow();
    expect(() => theme.setMode('dark')).not.toThrow();
    expect(theme.resolved()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});
