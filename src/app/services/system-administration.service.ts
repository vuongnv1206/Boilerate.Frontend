import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '@core/http/api-client';
import {
  CreateUserRequest,
  CapabilityDto,
  CapabilityRequest,
  FunctionDto,
  FunctionGroupDto,
  FunctionGroupRequest,
  PermissionPair,
  RoleDto,
  RoleRequest,
  SystemUserDto,
  UpdateUserRequest,
  UserPageDto,
  UserRoleDto,
} from '@models/system.dto';

@Injectable()
export class SystemAdministrationService {
  private readonly api = inject(ApiClient);
  roles(): Observable<readonly RoleDto[]> {
    return this.api.get('roles');
  }
  role(id: string): Observable<RoleDto> {
    return this.api.get(`roles/${encodeURIComponent(id)}`);
  }
  rolePermissions(id: string): Observable<readonly FunctionDto[]> {
    return this.api.get(`roles/${encodeURIComponent(id)}/permissions`);
  }
  saveRole(id: string | null, request: RoleRequest): Observable<string> {
    return this.api
      .text(id ? 'PUT' : 'POST', id ? `roles/${encodeURIComponent(id)}` : 'roles', request)
      .pipe(map((value) => id ?? value.trim().replace(/^"|"$/gu, '')));
  }
  savePermissions(
    id: string,
    version: string,
    permissions: readonly PermissionPair[],
  ): Observable<string> {
    return this.api.text('PUT', `roles/${encodeURIComponent(id)}/permissions`, {
      version,
      permissions,
    });
  }
  deleteRole(id: string, version: string): Observable<string> {
    return this.api.text(
      'DELETE',
      `roles/${encodeURIComponent(id)}?version=${encodeURIComponent(version)}`,
      null,
    );
  }
  groups(): Observable<readonly FunctionGroupDto[]> {
    return this.api.get('function-groups');
  }
  saveGroup(id: string | null, request: FunctionGroupRequest): Observable<FunctionGroupDto> {
    return id
      ? this.api.put(`function-groups/${encodeURIComponent(id)}`, request)
      : this.api.post('function-groups', request);
  }
  deleteGroup(id: string, version: string): Observable<void> {
    return this.api.delete(`function-groups/${encodeURIComponent(id)}`, { params: { version } });
  }
  functions(): Observable<readonly FunctionDto[]> {
    return this.api.get('functions');
  }
  actions(): Observable<readonly CapabilityDto[]> {
    return this.api.get('actions');
  }
  capability(kind: 'functions' | 'actions', id: string): Observable<FunctionDto | CapabilityDto> {
    return this.api.get(`${kind}/${encodeURIComponent(id)}`);
  }
  saveCapability(
    kind: 'functions' | 'actions',
    id: string | null,
    request: CapabilityRequest,
  ): Observable<FunctionDto | CapabilityDto> {
    return id
      ? this.api.put(`${kind}/${encodeURIComponent(id)}`, request)
      : this.api.post(kind, request);
  }
  saveFunctionActions(
    id: string,
    version: string,
    activeActionIds: readonly string[],
  ): Observable<FunctionDto> {
    return this.api.put(`functions/${encodeURIComponent(id)}/actions`, {
      version,
      activeActionIds,
    });
  }
  deleteCapability(kind: 'functions' | 'actions', id: string, version: string): Observable<void> {
    return this.api.delete(`${kind}/${encodeURIComponent(id)}`, { params: { version } });
  }
  users(keyword: string, page: number): Observable<UserPageDto> {
    return this.api.post('users/search', { keyword, pageNumber: page, pageSize: 10 });
  }
  user(id: string): Observable<SystemUserDto> {
    return this.api.get(`users/${encodeURIComponent(id)}`);
  }
  userRoles(id: string): Observable<readonly UserRoleDto[]> {
    return this.api.get(`users/${encodeURIComponent(id)}/roles`);
  }
  saveUserRoles(id: string, version: string, roleIds: readonly string[]): Observable<string> {
    return this.api.text('PUT', `users/${encodeURIComponent(id)}/roles`, { version, roleIds });
  }
  createUser(request: CreateUserRequest): Observable<string> {
    return this.api.post('users/create', request);
  }
  updateUser(id: string, request: UpdateUserRequest): Observable<void> {
    const form = new FormData();
    form.append('Version', request.version);
    form.append('FirstName', request.firstName);
    form.append('LastName', request.lastName);
    form.append('Email', request.email);
    if (request.phoneNumber) form.append('PhoneNumber', request.phoneNumber);
    if (request.image) form.append('Image', request.image, request.image.name);
    if (request.deleteCurrentImage) form.append('DeleteCurrentImage', 'true');
    return this.api.put(`users/${encodeURIComponent(id)}`, form);
  }
  toggleUserStatus(id: string, version: string, activateUser: boolean): Observable<void> {
    return this.api.post(`users/${encodeURIComponent(id)}/toggle-status`, {
      userId: id,
      version,
      activateUser,
    });
  }
  requestUserPasswordReset(id: string): Observable<string> {
    return this.api.post(`users/${encodeURIComponent(id)}/password-reset`, null);
  }
}
