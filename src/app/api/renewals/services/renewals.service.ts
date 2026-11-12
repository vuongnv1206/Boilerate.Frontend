import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import {
  ClaimRenewalRequest,
  ProvisionRenewalsRequest,
  ReleaseRenewalRequest,
  RenewalAdminDto,
  RenewalContentDto,
  RenewalDto,
  RenewalHistoryDto,
  RenewalPage,
  RenewalQueue,
  RenewalStatus,
  RevealedRenewalTargetDto,
  StartRenewalRequest,
  SubmitRenewalTargetRequest,
  VerifyRenewalRequest,
} from '../models/renewal.dto';

@Injectable({ providedIn: 'root' })
export class RenewalsService {
  constructor(private readonly api: ApiService) {}

  list(
    page: number,
    status: RenewalStatus | null,
    queue: RenewalQueue | null = null,
  ): Observable<RenewalPage> {
    return this.api.get<RenewalPage>('admin/renewals', {
      page,
      size: 20,
      ...(status === null ? {} : { status }),
      ...(queue ? { queue } : {}),
    });
  }

  getById(id: string): Observable<RenewalAdminDto> {
    return this.api.get<RenewalAdminDto>(`admin/renewals/${encodeURIComponent(id)}`);
  }

  getHistory(id: string): Observable<readonly RenewalHistoryDto[]> {
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

  revealAdminTarget(id: string): Observable<RevealedRenewalTargetDto> {
    return this.api.get<RevealedRenewalTargetDto>(
      `admin/renewals/${encodeURIComponent(id)}/target`,
    );
  }

  revealEvidence(id: string, attemptId: string): Observable<RenewalContentDto> {
    return this.api.get<RenewalContentDto>(
      `admin/renewals/${encodeURIComponent(id)}/attempts/${encodeURIComponent(attemptId)}/evidence`,
    );
  }

  provisionOrderRenewals(
    orderId: string,
    request: ProvisionRenewalsRequest,
  ): Observable<readonly RenewalDto[]> {
    return this.api.post<readonly RenewalDto[]>(
      `admin/orders/${encodeURIComponent(orderId)}/renewals/provision`,
      request,
    );
  }

  getCustomerOrderRenewals(orderId: string): Observable<readonly RenewalDto[]> {
    return this.api.get<readonly RenewalDto[]>(
      `orders/${encodeURIComponent(orderId)}/renewals`,
      undefined,
      { withCredentials: true },
    );
  }

  submitCustomerTarget(
    orderId: string,
    renewalId: string,
    body: SubmitRenewalTargetRequest,
  ): Observable<RenewalDto> {
    return this.api.put<RenewalDto>(
      `orders/${encodeURIComponent(orderId)}/renewals/${encodeURIComponent(renewalId)}/target`,
      body,
      { withCredentials: true },
    );
  }

  revealCustomerTarget(orderId: string, renewalId: string): Observable<RevealedRenewalTargetDto> {
    return this.api.get<RevealedRenewalTargetDto>(
      `orders/${encodeURIComponent(orderId)}/renewals/${encodeURIComponent(renewalId)}/target`,
      undefined,
      { withCredentials: true },
    );
  }
}
