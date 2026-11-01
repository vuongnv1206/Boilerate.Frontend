import { Provider, computed, inject } from '@angular/core';
import { AuthSession } from './core/auth/auth-session';
import { WORKSPACE_NAVIGATION } from './core/navigation/workspace-navigation';
import { COLLECTION_LINKS, SYSTEM_LINKS } from '@constants/navigation.constants';
import { hasNavigationPermission } from '@core/navigation/navigation-permission';

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
