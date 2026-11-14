import { CapabilityDto, FunctionDto, PermissionPair } from './identity.dto';

interface SystemListQuery {
  readonly q: string;
  readonly page: number;
}

export function readSystemListQuery(values: Readonly<Record<string, unknown>>): SystemListQuery {
  const rawPage = values['page'];
  const parsed = typeof rawPage === 'string' && /^\d+$/u.test(rawPage) ? Number(rawPage) : NaN;
  return {
    q: typeof values['q'] === 'string' ? values['q'].trim() : '',
    page: Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1,
  };
}

export function systemListQueryParams(query: SystemListQuery): Record<string, string | number> {
  return {
    ...(query.q ? { q: query.q } : {}),
    ...(query.page > 1 ? { page: query.page } : {}),
  };
}

export function permissionKey(functionId: string, actionId: string): string {
  return `${functionId}:${actionId}`;
}

export function permissionPairs(
  functions: readonly FunctionDto[],
  selected: ReadonlySet<string>,
): PermissionPair[] {
  return functions.flatMap((fn) =>
    fn.actionDtos
      .filter((action) => selected.has(permissionKey(fn.id, action.id)))
      .map((action) => ({ functionId: fn.id, actionId: action.id })),
  );
}

export function matchingFunctions(
  functions: readonly FunctionDto[],
  query: string,
): readonly FunctionDto[] {
  const keyword = query.trim().toLocaleLowerCase('vi');
  return functions.filter((fn) =>
    `${fn.name} ${fn.code}`.toLocaleLowerCase('vi').includes(keyword),
  );
}

export function groupActions(functions: readonly FunctionDto[]): readonly CapabilityDto[] {
  const actions = new Map<string, CapabilityDto>();
  for (const fn of functions.filter((item) => item.isActive)) {
    for (const action of fn.actionDtos.filter((item) => item.isActive)) {
      actions.set(action.id, action);
    }
  }
  return [...actions.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

export function actionKeys(functions: readonly FunctionDto[], actionId: string): readonly string[] {
  return functions
    .filter((fn) => fn.isActive && fn.actionDtos.some((a) => a.id === actionId && a.isActive))
    .map((fn) => permissionKey(fn.id, actionId));
}
