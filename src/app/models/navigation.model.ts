export interface WorkspaceCollectionLink {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
  readonly path: string;
  readonly count?: number;
}

export interface PermissionRequirement {
  readonly functionCode: string;
  readonly actionCode: string;
}

export interface ProtectedNavigationLink extends WorkspaceCollectionLink {
  readonly permission: PermissionRequirement;
  readonly centralAdmin?: boolean;
}
