import { Component, computed, input } from '@angular/core';

const paths: Readonly<Record<string, readonly string[]>> = {
  database: ['M4 6c0-2 16-2 16 0s-16 2-16 0v12c0 2 16 2 16 0V6', 'M4 12c0 2 16 2 16 0'],
  box: ['m12 3 9 5-9 5-9-5 9-5Z', 'm3 8 0 9 9 5 9-5V8', 'M12 13v9', 'm7 5 9 5'],
  layers: ['m12 3 10 6-10 6L2 9l10-6Z', 'm2 13 10 6 10-6', 'm2 17 10 6 10-6'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  settings: [
    'm9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 2 3-1 1-3 3-1 1-3-2-2 1-3-3-2-3 1-2-2-2 1Z',
    'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  ],
  help: [
    'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
    'M9 8a3 3 0 0 1 6 1c0 2-3 2-3 5',
    'M12 17h.01',
  ],
  info: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z', 'M12 11v6', 'M12 7h.01'],
  sun: [
    'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  ],
  moon: ['M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10Z'],
  monitor: ['M3 4h18v13H3z', 'M12 17v4m-4 0h8'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-up': ['m6 15 6-6 6 6'],
  'chevron-right': ['m9 6 6 6-6 6'],
  'chevron-left': ['m15 6-6 6 6 6'],
  plus: ['M12 5v14M5 12h14'],
  search: ['M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z', 'm15 15 6 6'],
  filter: ['M3 5h18l-7 8v6l-4 2v-8L3 5Z'],
  columns: ['M3 4h18v16H3z', 'M9 4v16m6-16v16'],
  'more-horizontal': ['M4 12h.01M12 12h.01M20 12h.01'],
  'arrow-left': ['M20 12H4m7-7-7 7 7 7'],
  'arrow-right': ['M4 12h16m-7-7 7 7-7 7'],
  check: ['m5 12 4 4L19 6'],
  x: ['m6 6 12 12M6 18 18 6'],
  close: ['m6 6 12 12M6 18 18 6'],
  'external-link': ['M14 3h7v7m0-7-11 11', 'M10 3H3v18h18v-7'],
  globe: [
    'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
    'M2 12h20M12 2c6 5 6 15 0 20-6-5-6-15 0-20Z',
  ],
  image: ['M3 3h18v18H3z', 'm3 16 5-5 5 5 3-3 5 5', 'M15 7h.01'],
  upload: ['M12 16V3m-5 5 5-5 5 5', 'M3 16v5h18v-5'],
  sliders: ['M4 7h16M4 17h16', 'M8 4v6m8 4v6'],
  tag: ['M3 3h8l10 10-8 8L3 11V3Z', 'M7 7h.01'],
  clock: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z', 'M12 6v6l4 2'],
  file: ['M5 2h9l5 5v15H5V2Z', 'M14 2v6h5M8 12h8M8 16h6'],
  circle: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
  alert: ['m12 3 10 18H2L12 3Z', 'M12 9v5m0 3h.01'],
  eye: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
  trash: ['M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7'],
  archive: ['M3 3h18v5H3z', 'M5 8v13h14V8M10 12h4'],
  copy: ['M8 8h13v13H8z', 'M16 8V3H3v13h5'],
  'panel-left': ['M3 4h18v16H3z', 'M9 4v16', 'm5 10 2 2-2 2'],
  palette: [
    'M12 3C1 3 0 18 10 21c5 2 2-4 5-5 6 0 10-4 6-9-2-3-6-4-9-4Z',
    'M7 8h.01M12 6h.01M17 8h.01M6 13h.01',
  ],
  'check-circle': ['M22 11v1a10 10 0 1 1-6-9', 'm8 11 4 4L22 3'],
  keyboard: ['M2 5h20v14H2z', 'M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h8'],
  folder: ['M2 5h8l2 3h10v13H2V5Z'],
  logout: ['M9 4H3v16h6M8 12h13m-5-5 5 5-5 5'],
  grip: ['M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01'],
  menu: ['M3 6h18M3 12h18M3 18h18'],
  'arrow-up-right': ['M6 18 18 6M6 6h12v12'],
  mail: ['M3 5h18v14H3z', 'm3 5 9 7 9-7'],
  link: ['m10 13 4-4', 'M8 16H6a4 4 0 0 1 0-8h4m4 0h4a4 4 0 0 1 0 8h-4'],
  'shopping-bag': ['M4 7h16l1 14H3L4 7Z', 'M8 8V6a4 4 0 0 1 8 0v2'],
  'book-open': ['M12 5C8 2 5 2 2 3v16c4-1 7-1 10 2 3-3 6-3 10-2V3c-4-1-7-1-10 2Z', 'M12 5v16'],
};

@Component({
  selector: 'ui-icon',
  template:
    '<svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">@for (path of data(); track $index) { <path [attr.d]="path" /> }</svg>',
  styles:
    ':host { display:inline-flex; flex:none; align-items:center; justify-content:center; vertical-align:middle; line-height:0; }',
})
export class Icon {
  readonly name = input('box');
  readonly size = input(16);
  protected readonly data = computed(() => paths[this.name()] ?? paths['box']);
}
