import { SystemKind } from '@models/system.model';

/** Screen bindings only. The permission catalogue and labels are owned by the API. */
export const SYSTEM_SECTIONS = {
  roles: { title: 'Vai trò và phân quyền', singular: 'vai trò', functionCode: 'Role' },
  users: { title: 'Người dùng', singular: 'người dùng', functionCode: 'User' },
  functions: { title: 'Chức năng', singular: 'chức năng', functionCode: 'Function' },
  actions: { title: 'Hành động', singular: 'hành động', functionCode: 'Action' },
} as const satisfies Record<SystemKind, { title: string; singular: string; functionCode: string }>;
