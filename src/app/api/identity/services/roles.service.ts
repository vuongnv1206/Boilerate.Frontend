import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import { FunctionDto, PermissionPair, RoleDto, RoleRequest } from '../models/identity.dto';

@Injectable({ providedIn: 'root' })
export class RolesService {
  constructor(private readonly api: ApiService) {}

  roles(): Observable<readonly RoleDto[]> {
    return this.api.get<readonly RoleDto[]>('roles');
  }

  role(id: string): Observable<RoleDto> {
    return this.api.get<RoleDto>(`roles/${encodeURIComponent(id)}`);
  }

  rolePermissions(id: string): Observable<readonly FunctionDto[]> {
    return this.api.get<readonly FunctionDto[]>(`roles/${encodeURIComponent(id)}/permissions`);
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
}
