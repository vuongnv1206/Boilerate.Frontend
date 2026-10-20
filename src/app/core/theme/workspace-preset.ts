import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

// Values live in styles/tokens. Both modes resolve these variables at the root,
// including PrimeNG overlays appended outside the routed component tree.
const workspaceScheme = {
  primary: {
    color: 'var(--accent)',
    contrastColor: 'var(--on-accent)',
    hoverColor: 'var(--accent-hover)',
    activeColor: 'var(--accent-active)',
  },
  surface: {
    0: 'var(--palette-surface-0)',
    50: 'var(--palette-surface-50)',
    100: 'var(--palette-surface-100)',
    200: 'var(--palette-surface-200)',
    300: 'var(--palette-surface-300)',
    400: 'var(--palette-surface-400)',
    500: 'var(--palette-surface-500)',
    600: 'var(--palette-surface-600)',
    700: 'var(--palette-surface-700)',
    800: 'var(--palette-surface-800)',
    900: 'var(--palette-surface-900)',
    950: 'var(--palette-surface-950)',
  },
  text: {
    color: 'var(--text-1)',
    hoverColor: 'var(--text-hover)',
    mutedColor: 'var(--text-2)',
    hoverMutedColor: 'var(--text-muted-hover)',
  },
  formField: {
    background: 'var(--surface-0)',
    disabledBackground: 'var(--surface-2)',
    filledBackground: 'var(--field-filled)',
    borderColor: 'var(--field-border)',
    hoverBorderColor: 'var(--text-3)',
    focusBorderColor: 'var(--accent)',
    invalidBorderColor: 'var(--danger)',
    color: 'var(--text-1)',
    disabledColor: 'var(--text-3)',
    placeholderColor: 'var(--text-3)',
  },
  content: {
    background: 'var(--surface-0)',
    hoverBackground: 'var(--surface-2)',
    borderColor: 'var(--border)',
    color: 'var(--text-1)',
    hoverColor: 'var(--content-hover-text)',
  },
  highlight: {
    background: 'var(--accent-soft)',
    focusBackground: 'var(--highlight-focus)',
    color: 'var(--highlight-text)',
    focusColor: 'var(--highlight-focus-text)',
  },
};

export const WorkspacePreset = definePreset(Aura, {
  primitive: {
    borderRadius: { none: '0', xs: '2px', sm: '3px', md: '4px', lg: '6px', xl: '8px' },
  },
  semantic: {
    primary: {
      50: 'var(--palette-blue-50)',
      100: 'var(--palette-blue-100)',
      200: 'var(--palette-blue-200)',
      300: 'var(--palette-blue-300)',
      400: 'var(--palette-blue-400)',
      500: 'var(--palette-blue-500)',
      600: 'var(--palette-blue-600)',
      700: 'var(--palette-blue-700)',
      800: 'var(--palette-blue-800)',
      900: 'var(--palette-blue-900)',
      950: 'var(--palette-blue-950)',
    },
    transitionDuration: 'var(--motion-base)',
    focusRing: { width: '2px', style: 'solid', color: 'var(--focus-ring)', offset: '2px' },
    formField: { paddingX: '9px', paddingY: '6px', borderRadius: 'var(--radius)', shadow: 'none' },
    colorScheme: { light: workspaceScheme, dark: workspaceScheme },
  },
  components: {
    select: {
      dropdown: { width: '28px' },
      option: { padding: '7px 9px', fontSize: '13px' },
      overlay: {
        borderColor: 'var(--border-strong)',
        borderRadius: '5px',
        shadow: 'var(--overlay-shadow)',
      },
    },
    multiselect: {
      dropdown: { width: '28px' },
      option: { padding: '7px 9px', fontSize: '13px' },
      overlay: {
        borderColor: 'var(--border-strong)',
        borderRadius: '5px',
        shadow: 'var(--overlay-shadow)',
      },
    },
    checkbox: {
      root: { width: '15px', height: '15px', borderRadius: '3px' },
      icon: { size: '10px' },
    },
    tabs: {
      tablist: { background: 'transparent', borderColor: 'var(--border)' },
      tab: {
        padding: '12px 16px',
        fontSize: '12px',
        fontWeight: '500',
        activeColor: 'var(--text-1)',
      },
      activeBar: { height: '2px', background: 'var(--accent)' },
      tabpanel: { background: 'transparent', padding: '20px 0 0', color: 'var(--text-1)' },
    },
  },
});
