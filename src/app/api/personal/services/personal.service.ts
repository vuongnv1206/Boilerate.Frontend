import { Injectable } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import { PagedResult, PaginationResponse, fromPaginationResponse } from '@core/http/pagination';
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
export class PersonalService {
  constructor(private readonly api: ApiService) {}

  getProfile(): Observable<PersonalProfileDto> {
    return this.api.get<PersonalProfileDto>('personal/profile');
  }

  updateProfile(request: UpdatePersonalProfileRequest): Observable<PersonalProfileDto> {
    return this.api
      .put<unknown>('personal/profile', request)
      .pipe(switchMap(() => this.getProfile()));
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.api.put<unknown>('personal/change-password', request).pipe(map(() => undefined));
  }

  linkGoogle(request: ExternalLinkRequest): Observable<void> {
    return this.api.post<void>('auth/google/link', request);
  }

  linkFacebook(request: ExternalLinkRequest): Observable<void> {
    return this.api.post<void>('auth/facebook/link', request);
  }

  getSessions(): Observable<readonly UserSessionDto[]> {
    return this.api.get<readonly UserSessionDto[]>('tokens/sessions');
  }

  revokeSession(sessionId: string): Observable<void> {
    return this.api.delete<void>(`tokens/sessions/${encodeURIComponent(sessionId)}`);
  }

  revokeAllSessions(): Observable<void> {
    return this.api.delete<void>('tokens/sessions');
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
    return this.api
      .post<PaginationResponse<AuditDto>>('personal/audit-logs', body)
      .pipe(map(fromPaginationResponse));
  }

  exportAuditLogs(filter: PersonalAuditFilter = {}): Observable<void> {
    const body = {
      keyword: filter.keyword?.trim() || undefined,
      tableName: filter.tableName ?? undefined,
      startDate: filter.startDate ?? filter.fromDate ?? undefined,
      endDate: filter.endDate ?? filter.toDate ?? undefined,
    };
    return this.api.download('POST', 'personal/audit-logs/export', body, 'nhat-ky-ca-nhan.xlsx');
  }
}
