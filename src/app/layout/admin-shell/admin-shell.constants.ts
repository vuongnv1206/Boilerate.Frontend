import type { ThemeMode } from '@core/theme/theme-controller';

export const ADMIN_LAYOUT = {
  mobileQuery: '(max-width: 760px)',
  railWidth: 44,
  panelMin: 200,
  panelDefault: 240,
  panelMax: 320,
  resizeStep: 8,
  widthStorageKey: 'boilerate.context-width',
  collapsedStorageKey: 'boilerate.context-collapsed',
} as const;

export const ADMIN_THEME_OPTIONS = [
  { mode: 'light', label: 'Sáng', icon: 'sun' },
  { mode: 'dark', label: 'Tối', icon: 'moon' },
  { mode: 'system', label: 'Hệ thống', icon: 'monitor' },
] as const satisfies readonly { mode: ThemeMode; label: string; icon: string }[];
