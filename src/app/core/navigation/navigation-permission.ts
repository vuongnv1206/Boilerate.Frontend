interface PermissionReader {
  can(functionCode: string, actionCode: string): boolean;
}

function isRequirement(value: unknown): value is { functionCode: string; actionCode: string } {
  if (!value || typeof value !== 'object') return false;
  const requirement = value as Record<string, unknown>;
  return (
    typeof requirement['functionCode'] === 'string' && typeof requirement['actionCode'] === 'string'
  );
}

export function hasNavigationPermission(session: PermissionReader, permission: unknown): boolean {
  if (isRequirement(permission)) return session.can(permission.functionCode, permission.actionCode);
  if (!permission || typeof permission !== 'object') return false;
  const anyOf = (permission as Record<string, unknown>)['anyOf'];
  return (
    Array.isArray(anyOf) &&
    anyOf.length > 0 &&
    anyOf.every(isRequirement) &&
    anyOf.some((requirement) => session.can(requirement.functionCode, requirement.actionCode))
  );
}
