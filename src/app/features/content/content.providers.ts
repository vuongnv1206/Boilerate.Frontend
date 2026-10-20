import { Provider } from '@angular/core';
import { ContentService } from './data-access/content.service';
import { MockContentService } from './data-access/mock-content.service';
import { ContentNavigation } from './navigation/content-navigation';
import { ContentViewStore } from './state/content-view.store';

/** One data session shared by content pages and navigation, below the admin route. */
export function provideContentFeature(): Provider[] {
  return [
    { provide: ContentService, useClass: MockContentService },
    ContentViewStore,
    ContentNavigation,
  ];
}
