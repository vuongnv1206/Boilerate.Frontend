import { Provider } from '@angular/core';
import { WORKSPACE_NAVIGATION } from './core/navigation/workspace-navigation';
import { ContentWorkspaceNavigation } from './features/content-workspace';

/** The application composition layer is the only place wiring features into chrome. */
export function provideWorkspaceNavigation(): Provider[] {
  return [{ provide: WORKSPACE_NAVIGATION, useExisting: ContentWorkspaceNavigation }];
}
