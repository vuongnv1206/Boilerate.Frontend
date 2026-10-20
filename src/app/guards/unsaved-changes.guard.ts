import { CanDeactivateFn } from '@angular/router';

/** Each editor decides whether it can leave or needs to show its confirmation. */
export const unsavedChangesGuard: CanDeactivateFn<{
  confirmLeave(): boolean | Promise<boolean>;
}> = (screen) => screen.confirmLeave();
