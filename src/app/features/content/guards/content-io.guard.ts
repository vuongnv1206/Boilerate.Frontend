import { CanDeactivateFn } from '@angular/router';
import { ContentIo } from '../pages/content-io/content-io';

export const contentIoGuard: CanDeactivateFn<ContentIo> = (page) => page.confirmLeave();
