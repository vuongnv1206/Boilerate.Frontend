import { Injectable } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';
import { BaseApiService, PagedResult } from '@core/base';
import {
  AuditDto,
  ChangePasswordRequest,
  ExternalLinkRequest,
  PersonalAuditFilter,
  PersonalProfileDto,
  UpdatePersonalProfileRequest,
  UserSessionDto,
} from '../models/personal.dto';

@Injectable({ providedIn: 'root' })
export class PersonalService extends BaseApiService {
  getProfile(): Observable<PersonalProfileDto> {
    return this.get<PersonalProfileDto>('personal/profile');
  }

  updateProfile(request: UpdatePersonalProfileRequest): Observable<PersonalProfileDto> {
    return this.put<unknown>('personal/profile', request).pipe(switchMap(() => this.getProfile()));
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.put<unknown>('personal/change-password', request).pipe(map(() => undefined));
  }

  linkGoogle(request: ExternalLinkRequest): Observable<void> {
    return this.post<void>('auth/google/link', request);
  }

  linkFacebook(request: ExternalLinkRequest): Observable<void> {
    return this.post<void>('auth/facebook/link', request);
  }

  getSessions(): Observable<readonly UserSessionDto[]> {
    return this.get<readonly UserSessionDto[]>('tokens/sessions');
  }

  revokeSession(sessionId: string): Observable<void> {
    return this.deleteResource<void>(`tokens/sessions/${encodeURIComponent(sessionId)}`);
  }

  revokeAllSessions(): Observable<void> {
    return this.deleteResource<void>('tokens/sessions');
  }

  getAuditLogs(filter: PersonalAuditFilter = {}): Observable<PagedResult<AuditDto>> {
    const body = {
      keyword: filter.keyword?.trim() || undefined,
      pageNumber: filter.pageNumber ?? 1,
      pageSize: filter.pageSize ?? 10,
      tableName: filter.tableName ?? undefined,
      type: filter.type ?? undefined,
      fromDate: filter.fromDate ?? undefined,
      toDate: filter.toDate ?? undefined,
    };
    return this.postPageFrom<AuditDto>('personal/audit-logs', body);
  }

  exportAuditLogs(filter: PersonalAuditFilter = {}): Observable<void> {
    const body = {
      keyword: filter.keyword?.trim() || undefined,
      tableName: filter.tableName ?? undefined,
      startDate: filter.startDate ?? filter.fromDate ?? undefined,
      endDate: filter.endDate ?? filter.toDate ?? undefined,
    };
    return this.downloadBlob('POST', 'personal/audit-logs/export', body, 'nhat-ky-ca-nhan.xlsx');
  }
}
