import { InjectionToken, Signal } from '@angular/core';

export interface WorkspaceCollectionLink {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
  readonly path: string;
  readonly count: number;
}

/** Presentation contract consumed by the shell; feature data stays with its owner. */
export interface WorkspaceNavigation {
  readonly collections: Signal<readonly WorkspaceCollectionLink[]>;
}

export const WORKSPACE_NAVIGATION = new InjectionToken<WorkspaceNavigation>('Workspace navigation');
