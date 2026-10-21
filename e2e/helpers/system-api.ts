import { BrowserContext, Route } from '@playwright/test';

interface SystemUser {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  imageUrl: string | null;
  emailConfirmed: boolean;
  isActive: boolean;
  version: string;
}

export async function installSystemApi(
  context: BrowserContext,
  centralAdmin = true,
  includeCatalog = true,
) {
  let revision = 1;
  const groups = [
    { id: 'catalog', code: 'Catalog', name: 'Danh mục và sản phẩm', sortOrder: 10, version: 'g1' },
    { id: 'system', code: 'System', name: 'Hệ thống', sortOrder: 20, version: 'g2' },
  ];
  const actions = [
    { id: 'view', code: 'View', name: 'Xem' },
    { id: 'create', code: 'Create', name: 'Thêm mới' },
    { id: 'update', code: 'Update', name: 'Cập nhật' },
    { id: 'delete', code: 'Delete', name: 'Xóa' },
    { id: 'approve', code: 'Approve', name: 'Phê duyệt' },
  ].map((a) => ({ ...a, version: 'a1', isActive: true, selected: false }));
  const functions = [
    {
      id: 'product',
      code: 'Product',
      name: 'Sản phẩm',
      groupId: 'catalog',
      actionDtos: [actions[0]!, actions[1]!, actions[2]!],
    },
    {
      id: 'category',
      code: 'Category',
      name: 'Danh mục',
      groupId: 'catalog',
      actionDtos: [actions[0]!, actions[3]!],
    },
    {
      id: 'automation',
      code: 'Automation',
      name: 'Tự động hóa',
      groupId: 'system',
      actionDtos: [actions[4]!],
    },
  ].map((f) => ({ ...f, version: 'f1', isActive: true, selected: false }));
  const roles = [
    {
      id: 'editor',
      name: 'Nhân viên nội dung',
      description: 'Quản lý nội dung cửa hàng',
      version: 'r1',
    },
  ];
  const permissions = new Map<string, Array<{ functionId: string; actionId: string }>>([
    ['editor', [{ functionId: 'category', actionId: 'view' }]],
  ]);
  const user: SystemUser = {
    id: 'worker',
    userName: 'staff',
    firstName: 'Nhân viên',
    lastName: 'Nội dung',
    email: 'staff@example.test',
    phoneNumber: '0900000001',
    imageUrl: null,
    emailConfirmed: true,
    isActive: true,
    version: 'u1',
  };
  const users = [user];
  const assignedRoles = new Map([['worker', ['editor']]]);
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  let saveFailure = 0;
  let userGrants: readonly string[] = ['View', 'Create', 'Update', 'Delete'];
  let userFailure: { status: number; errors?: Record<string, string[]> } | null = null;
  const reply = (route: Route, data: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  const text = (route: Route, value: string) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: value });
  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\//u, '');
    const method = request.method();
    const contentType = request.headers()['content-type'] ?? '';
    const body = contentType.startsWith('multipart/form-data')
      ? multipartFields(request.postDataBuffer()?.toString('utf8') ?? '', contentType)
      : (request.postDataJSON() as Record<string, unknown> | null);
    if (path === 'personal/authorization')
      return reply(route, {
        isCentralAdmin: centralAdmin,
        permissions: [
          ...['Role', 'Function', 'Action'].flatMap((f) =>
            ['View', 'Create', 'Update', 'Delete'].map((a) => `Permissions.${f}.${a}`),
          ),
          ...userGrants.map((action) => `Permissions.User.${action}`),
          ...(includeCatalog
            ? [
                'Permissions.Product.View',
                'Permissions.Product.Create',
                'Permissions.Product.Update',
                'Permissions.Category.View',
                'Permissions.ProductType.View',
              ]
            : []),
        ],
      });
    if (!/^(roles|users|functions|actions|function-groups)(\/|$)/u.test(path))
      return route.fallback();
    if (method !== 'GET') writes.push({ path, body: body ?? {} });
    if (userFailure && path.startsWith('users/') && path !== 'users/search' && method !== 'GET') {
      const { status, errors } = userFailure;
      userFailure = null;
      return reply(route, { status, title: 'Rejected', errors }, status);
    }
    if (saveFailure && method === 'PUT') {
      const status = saveFailure;
      saveFailure = 0;
      return reply(route, { status, title: 'Rejected', code: 'conflict' }, status);
    }
    if (path === 'function-groups') {
      if (method === 'GET') return reply(route, groups);
      if (method === 'POST') {
        const group = {
          id: `group-${++revision}`,
          code: String(body?.['code']),
          name: String(body?.['name']),
          sortOrder: Number(body?.['sortOrder']),
          version: `g${revision}`,
        };
        groups.push(group);
        return reply(route, group);
      }
    }
    if (path.startsWith('function-groups/')) {
      const group = groups.find((g) => g.id === path.split('/')[1]);
      if (!group) return reply(route, {}, 404);
      if (method === 'PUT') {
        group.name = String(body?.['name']);
        group.sortOrder = Number(body?.['sortOrder']);
        group.version = `g${++revision}`;
        return reply(route, group);
      }
      if (method === 'DELETE') {
        if (functions.some((f) => f.groupId === group.id)) return reply(route, {}, 409);
        groups.splice(groups.indexOf(group), 1);
        return route.fulfill({ status: 204 });
      }
    }
    if (path === 'roles') {
      if (method === 'GET') return reply(route, roles);
      if (method === 'POST') {
        const role = {
          id: `role-${++revision}`,
          name: String(body?.['name']),
          description: String(body?.['description'] ?? ''),
          version: `r${revision}`,
        };
        roles.push(role);
        permissions.set(role.id, []);
        return text(route, role.id);
      }
    }
    if (path.startsWith('roles/')) {
      const role = roles.find((r) => r.id === path.split('/')[1]);
      if (!role) return reply(route, {}, 404);
      if (path.endsWith('/permissions')) {
        if (method === 'GET')
          return reply(
            route,
            functions.map((f) => ({
              ...f,
              actionDtos: f.actionDtos.map((a) => ({
                ...a,
                selected:
                  permissions
                    .get(role.id)
                    ?.some((p) => p.functionId === f.id && p.actionId === a.id) ?? false,
              })),
            })),
          );
        if (method === 'PUT') {
          permissions.set(
            role.id,
            body?.['permissions'] as Array<{ functionId: string; actionId: string }>,
          );
          role.version = `r${++revision}`;
          return text(route, 'Permissions updated.');
        }
      }
      if (method === 'GET') return reply(route, role);
      if (method === 'PUT') {
        role.name = String(body?.['name']);
        role.description = String(body?.['description'] ?? '');
        role.version = `r${++revision}`;
        return text(route, role.id);
      }
      if (method === 'DELETE') {
        roles.splice(roles.indexOf(role), 1);
        return text(route, 'Deleted.');
      }
    }
    if (path === 'users/search') return reply(route, { data: users, totalCount: users.length });
    if (path === 'users/create' && method === 'POST') {
      const created: SystemUser = {
        id: `user-${++revision}`,
        userName: String(body?.['userName']),
        firstName: String(body?.['firstName']),
        lastName: String(body?.['lastName']),
        email: String(body?.['email']),
        phoneNumber: (body?.['phoneNumber'] as string | null) ?? null,
        imageUrl: null,
        emailConfirmed: false,
        isActive: true,
        version: `u${revision}`,
      };
      users.push(created);
      assignedRoles.set(created.id, []);
      const message = `User ${created.userName} Registered.`;
      return request.headers()['accept'] === 'application/json'
        ? reply(route, message)
        : text(route, message);
    }
    const targetUser = path.startsWith('users/')
      ? users.find((candidate) => candidate.id === path.split('/')[1])
      : undefined;
    if (targetUser && /^users\/[^/]+$/u.test(path)) {
      if (method === 'GET') return reply(route, targetUser);
      if (method === 'PUT') {
        if (body?.['Id'] !== targetUser.id)
          return reply(route, { status: 400, errors: { Id: ['The Id field is required.'] } }, 400);
        if (body?.['Version'] !== targetUser.version)
          return reply(route, { status: 409, title: 'Version conflict' }, 409);
        targetUser.firstName = String(body?.['FirstName']);
        targetUser.lastName = String(body?.['LastName']);
        targetUser.phoneNumber = (body?.['PhoneNumber'] as string | undefined) ?? null;
        if (body?.['Image']) targetUser.imageUrl = `/uploads/${String(body['Image'])}`;
        else if (body?.['DeleteCurrentImage'] === 'true') targetUser.imageUrl = null;
        targetUser.version = `u${++revision}`;
        return reply(route, { message: 'User profile updated successfully' });
      }
    }
    if (targetUser && path.endsWith('/toggle-status') && method === 'POST') {
      if (body?.['version'] !== targetUser.version)
        return reply(route, { status: 409, title: 'Version conflict' }, 409);
      targetUser.isActive = Boolean(body?.['activateUser']);
      targetUser.version = `u${++revision}`;
      return reply(route, { message: 'User status updated successfully' });
    }
    if (targetUser && path.endsWith('/password-reset') && method === 'POST') {
      const message =
        'If your email is registered, you will receive a password reset link shortly.';
      return request.headers()['accept'] === 'application/json'
        ? reply(route, message)
        : text(route, message);
    }
    if (targetUser && path.endsWith('/roles')) {
      if (method === 'GET')
        return reply(
          route,
          roles.map((r) => ({
            roleId: r.id,
            roleName: r.name,
            description: r.description,
            enabled: assignedRoles.get(targetUser.id)?.includes(r.id) ?? false,
          })),
        );
      if (body?.['version'] !== targetUser.version)
        return reply(route, { status: 409, title: 'Version conflict' }, 409);
      assignedRoles.set(targetUser.id, body?.['roleIds'] as string[]);
      targetUser.version = `u${++revision}`;
      return text(route, 'User roles updated.');
    }
    if (path === 'functions' && method === 'GET') return reply(route, functions);
    if (path === 'actions' && method === 'GET') return reply(route, actions);
    if (path === 'functions' && method === 'POST') {
      const created = {
        id: `function-${++revision}`,
        code: String(body?.['code']),
        name: String(body?.['name']),
        groupId: String(body?.['groupId']),
        version: `f${revision}`,
        isActive: Boolean(body?.['isActive']),
        selected: false,
        actionDtos: [],
      };
      functions.push(created);
      return reply(route, created);
    }
    if (path === 'actions' && method === 'POST') {
      const created = {
        id: `action-${++revision}`,
        code: String(body?.['code']),
        name: String(body?.['name']),
        version: `a${revision}`,
        isActive: Boolean(body?.['isActive']),
        selected: false,
      };
      actions.push(created);
      return reply(route, created);
    }
    const capability = path.startsWith('functions/')
      ? functions.find((f) => f.id === path.split('/')[1])
      : actions.find((a) => a.id === path.split('/')[1]);
    if (capability && method === 'GET') return reply(route, capability);
    if (capability && method === 'PUT') {
      if (path.endsWith('/actions') && 'actionDtos' in capability) {
        capability.actionDtos = actions
          .filter((a) => (body?.['activeActionIds'] as string[]).includes(a.id))
          .map((a) => ({ ...a, selected: true }));
      } else {
        capability.name = String(body?.['name']);
        capability.isActive = Boolean(body?.['isActive']);
        if ('groupId' in capability) capability.groupId = String(body?.['groupId']);
      }
      capability.version = `saved-${++revision}`;
      return reply(route, capability);
    }
    if (capability && method === 'DELETE') {
      if (path.startsWith('functions/'))
        functions.splice(
          functions.findIndex((f) => f.id === capability.id),
          1,
        );
      else
        actions.splice(
          actions.findIndex((a) => a.id === capability.id),
          1,
        );
      return route.fulfill({ status: 204 });
    }
    return route.fallback();
  });
  return {
    groups,
    roles,
    users,
    writes,
    permissions,
    setUserPermissions: (grants: readonly string[]) => {
      userGrants = grants;
    },
    failNextUserMutation: (status: number, errors?: Record<string, string[]>) => {
      userFailure = { status, errors };
    },
    failNextSave: (status: number) => {
      saveFailure = status;
    },
  };
}

function multipartFields(data: string, contentType: string): Record<string, string> {
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/u);
  const fields: Record<string, string> = {};
  for (const part of data.split(`--${boundary?.[1] ?? boundary?.[2] ?? ''}`)) {
    const name = part.match(/name="([^"]+)"/u)?.[1];
    const separator = part.indexOf('\r\n\r\n');
    if (!name || separator < 0) continue;
    fields[name] =
      part.match(/filename="([^"]+)"/u)?.[1] ?? part.slice(separator + 4).replace(/\r\n$/u, '');
  }
  return fields;
}
