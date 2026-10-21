import { CapabilityDto, FunctionDto, PermissionPair } from '@models/system.dto';

export function permissionKey(functionId: string, actionId: string): string {
  return `${functionId}:${actionId}`;
}
export function permissionPairs(
  functions: readonly FunctionDto[],
  selected: ReadonlySet<string>,
): PermissionPair[] {
  return functions.flatMap((f) =>
    f.actionDtos
      .filter((a) => selected.has(permissionKey(f.id, a.id)))
      .map((a) => ({ functionId: f.id, actionId: a.id })),
  );
}
export function matchingFunctions(
  functions: readonly FunctionDto[],
  query: string,
): readonly FunctionDto[] {
  const keyword = query.trim().toLocaleLowerCase('vi');
  return functions.filter((f) => `${f.name} ${f.code}`.toLocaleLowerCase('vi').includes(keyword));
}
export function groupActions(functions: readonly FunctionDto[]): readonly CapabilityDto[] {
  const actions = new Map<string, CapabilityDto>();
  for (const f of functions.filter((item) => item.isActive)) {
    for (const a of f.actionDtos.filter((item) => item.isActive)) actions.set(a.id, a);
  }
  return [...actions.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}
export function actionKeys(functions: readonly FunctionDto[], actionId: string): readonly string[] {
  return functions
    .filter((f) => f.isActive && f.actionDtos.some((a) => a.id === actionId && a.isActive))
    .map((f) => permissionKey(f.id, actionId));
}
