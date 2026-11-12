import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import {
  CreateUserRequest,
  ExportUsersRequest,
  SystemUserDto,
  UpdateUserRequest,
  UserPageDto,
  UserRoleDto,
  UserSearchFilter,
} from '../models/identity.dto';

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private readonly api: ApiService) {}

  searchUsers(filterOrKeyword: UserSearchFilter | string = '', page = 1): Observable<UserPageDto> {
    const body =
      typeof filterOrKeyword === 'string'
        ? { keyword: filterOrKeyword, pageNumber: page, pageSize: 10 }
        : {
            keyword: filterOrKeyword.keyword ?? '',
            pageNumber: filterOrKeyword.pageNumber ?? 1,
            pageSize: filterOrKeyword.pageSize ?? 10,
            ...(filterOrKeyword.isActive !== undefined && filterOrKeyword.isActive !== null
              ? { isActive: filterOrKeyword.isActive }
              : {}),
          };
    return this.api.post<UserPageDto>('users/search', body);
  }

  getUser(id: string): Observable<SystemUserDto> {
    return this.api.get<SystemUserDto>(`users/${encodeURIComponent(id)}`);
  }

  createUser(request: CreateUserRequest): Observable<string> {
    return this.api.post<string>('users/create', request, {
      headers: { Accept: 'application/json' },
    });
  }

  updateUser(id: string, request: UpdateUserRequest): Observable<void> {
    const form = new FormData();
    form.append('Id', id);
    form.append('Version', request.version);
    form.append('FirstName', request.firstName);
    form.append('LastName', request.lastName);
    form.append('Email', request.email);
    if (request.phoneNumber) form.append('PhoneNumber', request.phoneNumber);
    if (request.image) form.append('Image', request.image, request.image.name);
    if (request.deleteCurrentImage) form.append('DeleteCurrentImage', 'true');
    return this.api.put<void>(`users/${encodeURIComponent(id)}`, form);
  }

  getUserRoles(id: string): Observable<readonly UserRoleDto[]> {
    return this.api.get<readonly UserRoleDto[]>(`users/${encodeURIComponent(id)}/roles`);
  }

  saveUserRoles(id: string, version: string, roleIds: readonly string[]): Observable<string> {
    return this.api.text('PUT', `users/${encodeURIComponent(id)}/roles`, { version, roleIds });
  }

  toggleUserStatus(id: string, version: string, activateUser: boolean): Observable<void> {
    return this.api.post<void>(`users/${encodeURIComponent(id)}/toggle-status`, {
      userId: id,
      version,
      activateUser,
    });
  }

  requestPasswordReset(id: string): Observable<string> {
    return this.api.post<string>(`users/${encodeURIComponent(id)}/password-reset`, null, {
      headers: { Accept: 'application/json' },
    });
  }

  exportUsers(filter: ExportUsersRequest = {}): Observable<void> {
    const body = {
      keyword: filter.keyword?.trim() || undefined,
      isActive: filter.isActive ?? undefined,
      role: filter.role ?? undefined,
    };
    return this.api.download('POST', 'users/export', body, 'danh-sach-nguoi-dung.xlsx');
  }
}
