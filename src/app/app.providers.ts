import { Provider } from '@angular/core';
import { WORKSPACE_NAVIGATION } from './core/navigation/workspace-navigation';
import { ContentNavigation, provideContentFeature } from './features/content';

/** The application composition layer is the only place wiring features into chrome. */
export function provideWorkspaceNavigation(): Provider[] {
  return [
    provideContentFeature(),
    { provide: WORKSPACE_NAVIGATION, useExisting: ContentNavigation },
  ];
}
