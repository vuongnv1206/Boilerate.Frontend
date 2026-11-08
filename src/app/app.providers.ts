import { Provider, computed, inject } from '@angular/core';
import { AuthSession } from './core/auth/auth-session';
import { COLLECTION_LINKS, SYSTEM_LINKS } from './core/navigation/navigation.constants';
import { hasNavigationPermission } from './core/navigation/navigation-permission';
import { WORKSPACE_NAVIGATION } from './core/navigation/workspace-navigation';

export function provideWorkspaceNavigation(): Provider[] {
  return [
    {
      provide: WORKSPACE_NAVIGATION,
      useFactory: () => {
        const session = inject(AuthSession);
        return {
          collections: computed(() =>
            COLLECTION_LINKS.filter((link) => hasNavigationPermission(session, link.permission)),
          ),
          system: computed(() =>
            session.isCentralAdmin()
              ? SYSTEM_LINKS.filter((link) => hasNavigationPermission(session, link.permission))
              : [],
          ),
        };
      },
    },
  ];
}
