import { Provider, signal } from '@angular/core';
import { WORKSPACE_NAVIGATION } from './core/navigation/workspace-navigation';
import { COLLECTION_LINKS } from './app.navigation';

/** The application composition layer is the only place wiring features into chrome. */
export function provideWorkspaceNavigation(): Provider[] {
  return [
    {
      provide: WORKSPACE_NAVIGATION,
      useFactory: () => ({ collections: signal(COLLECTION_LINKS).asReadonly() }),
    },
  ];
}
