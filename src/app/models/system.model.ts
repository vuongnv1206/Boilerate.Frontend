export type SystemKind = 'roles' | 'users' | 'functions' | 'actions';

export interface SystemRow {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly code?: string;
  readonly description?: string | null;
  readonly email?: string | null;
  readonly isActive?: boolean;
  readonly groupId?: string;
}
