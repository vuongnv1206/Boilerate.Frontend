import { CanDeactivateFn } from '@angular/router';
import type { ItemEditor } from './item-editor';

export const itemEditorGuard: CanDeactivateFn<ItemEditor> = (editor) => editor.confirmLeave();
