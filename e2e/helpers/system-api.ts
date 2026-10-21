import { BrowserContext, Route } from '@playwright/test';

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
  const user = {
    id: 'worker',
    userName: 'staff',
    firstName: 'Nhân viên',
    lastName: 'Nội dung',
    email: 'staff@example.test',
    isActive: true,
    version: 'u1',
  };
  let assignedRoles = ['editor'];
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  let saveFailure = 0;
  const reply = (route: Route, data: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  const text = (route: Route, value: string) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: value });
  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\//u, '');
    const method = request.method();
    const body = request.postDataJSON() as Record<string, unknown> | null;
    if (path === 'personal/authorization')
      return reply(route, {
        isCentralAdmin: centralAdmin,
        permissions: [
          ...['Role', 'User', 'Function', 'Action'].flatMap((f) =>
            ['View', 'Create', 'Update', 'Delete'].map((a) => `Permissions.${f}.${a}`),
          ),
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
    if (method !== 'GET' && body) writes.push({ path, body });
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
    if (path === 'users/search') return reply(route, { data: [user], totalCount: 1 });
    if (path === 'users/worker') return reply(route, user);
    if (path === 'users/worker/roles') {
      if (method === 'GET')
        return reply(
          route,
          roles.map((r) => ({
            roleId: r.id,
            roleName: r.name,
            description: r.description,
            enabled: assignedRoles.includes(r.id),
          })),
        );
      assignedRoles = body?.['roleIds'] as string[];
      user.version = `u${++revision}`;
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
    writes,
    permissions,
    failNextSave: (status: number) => {
      saveFailure = status;
    },
  };
}
