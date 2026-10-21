import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/http/api-client';
import {
  ClaimRenewalRequest,
  RenewalAdminDto,
  RenewalContentDto,
  RenewalHistoryDto,
  RenewalPage,
  RenewalStatus,
  ReleaseRenewalRequest,
  StartRenewalRequest,
  VerifyRenewalRequest,
} from '@models/renewal.dto';

@Injectable()
export class RenewalsService {
  private readonly api = inject(ApiClient);

  list(page: number, status: RenewalStatus | null): Observable<RenewalPage> {
    return this.api.get<RenewalPage>('admin/renewals', {
      params: { page, size: 20, ...(status === null ? {} : { status }) },
    });
  }

  get(id: string): Observable<RenewalAdminDto> {
    return this.api.get<RenewalAdminDto>(`admin/renewals/${encodeURIComponent(id)}`);
  }

  history(id: string): Observable<readonly RenewalHistoryDto[]> {
    return this.api.get<readonly RenewalHistoryDto[]>(
      `admin/renewals/${encodeURIComponent(id)}/history`,
    );
  }

  claim(id: string, request: ClaimRenewalRequest): Observable<RenewalAdminDto> {
    return this.api.post<RenewalAdminDto>(
      `admin/renewals/${encodeURIComponent(id)}/claim`,
      request,
    );
  }

  release(id: string, request: ReleaseRenewalRequest): Observable<RenewalAdminDto> {
    return this.api.post<RenewalAdminDto>(
      `admin/renewals/${encodeURIComponent(id)}/release`,
      request,
    );
  }

  start(id: string, request: StartRenewalRequest): Observable<RenewalAdminDto> {
    return this.api.post<RenewalAdminDto>(
      `admin/renewals/${encodeURIComponent(id)}/start`,
      request,
    );
  }

  verify(id: string, request: VerifyRenewalRequest): Observable<RenewalAdminDto> {
    return this.api.post<RenewalAdminDto>(
      `admin/renewals/${encodeURIComponent(id)}/verify`,
      request,
    );
  }

  revealTarget(id: string): Observable<RenewalContentDto> {
    return this.api.get<RenewalContentDto>(`admin/renewals/${encodeURIComponent(id)}/target`);
  }

  revealEvidence(id: string, attemptId: string): Observable<RenewalContentDto> {
    return this.api.get<RenewalContentDto>(
      `admin/renewals/${encodeURIComponent(id)}/attempts/${encodeURIComponent(attemptId)}/evidence`,
    );
  }
}
