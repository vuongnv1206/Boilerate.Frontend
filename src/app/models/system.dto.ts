export interface CapabilityDto {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly version: string;
  readonly isActive: boolean;
}
export interface ActionDto extends CapabilityDto {
  readonly selected: boolean;
}
export interface FunctionDto extends CapabilityDto {
  readonly groupId: string;
  readonly actionDtos: readonly ActionDto[];
}
export interface FunctionGroupDto {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly version: string;
}
export interface RoleDto {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly version: string;
}
export interface SystemUserDto {
  readonly id: string;
  readonly userName: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly email: string | null;
  readonly phoneNumber: string | null;
  readonly isActive: boolean;
  readonly emailConfirmed: boolean;
  readonly imageUrl: string | null;
  readonly version: string;
}
export interface UserRoleDto {
  readonly roleId: string;
  readonly roleName: string;
  readonly description: string | null;
  readonly enabled: boolean;
}
export interface UserPageDto {
  readonly data: readonly SystemUserDto[];
  readonly totalCount: number;
}
export interface CreateUserRequest {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly userName: string;
  readonly password: string;
  readonly confirmPassword: string;
  readonly phoneNumber: string | null;
}
export interface UpdateUserRequest {
  readonly version: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phoneNumber: string | null;
  readonly image?: File | null;
  readonly deleteCurrentImage?: boolean;
}
export interface CapabilityRequest {
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly version?: string;
  readonly groupId?: string;
}
export interface FunctionGroupRequest {
  readonly code: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly version?: string;
}
export interface RoleRequest {
  readonly name: string;
  readonly description: string | null;
  readonly version?: string;
}
export interface PermissionPair {
  readonly functionId: string;
  readonly actionId: string;
}
