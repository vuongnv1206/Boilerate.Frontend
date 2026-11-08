import { InjectionToken, Signal } from '@angular/core';
import { WorkspaceCollectionLink } from './navigation.model';
export type {
  NavigationPermission,
  PermissionRequirement,
  ProtectedNavigationLink,
  WorkspaceCollectionLink,
} from './navigation.model';

/** Presentation contract consumed by the shell; feature data stays with its owner. */
export interface WorkspaceNavigation {
  readonly collections: Signal<readonly WorkspaceCollectionLink[]>;
  readonly system: Signal<readonly WorkspaceCollectionLink[]>;
}

export const WORKSPACE_NAVIGATION = new InjectionToken<WorkspaceNavigation>('Workspace navigation');
