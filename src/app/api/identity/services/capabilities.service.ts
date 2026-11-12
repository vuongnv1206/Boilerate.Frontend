import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import {
  CapabilityDto,
  CapabilityKind,
  CapabilityRequest,
  FunctionDto,
  FunctionGroupDto,
  FunctionGroupRequest,
} from '../models/identity.dto';

@Injectable({ providedIn: 'root' })
export class CapabilitiesService {
  constructor(private readonly api: ApiService) {}

  groups(): Observable<readonly FunctionGroupDto[]> {
    return this.api.get<readonly FunctionGroupDto[]>('function-groups');
  }

  saveGroup(id: string | null, request: FunctionGroupRequest): Observable<FunctionGroupDto> {
    return id
      ? this.api.put<FunctionGroupDto>(`function-groups/${encodeURIComponent(id)}`, request)
      : this.api.post<FunctionGroupDto>('function-groups', request);
  }

  deleteGroup(id: string, version: string): Observable<void> {
    return this.api.delete<void>(`function-groups/${encodeURIComponent(id)}`, { version });
  }

  functions(): Observable<readonly FunctionDto[]> {
    return this.api.get<readonly FunctionDto[]>('functions');
  }

  actions(): Observable<readonly CapabilityDto[]> {
    return this.api.get<readonly CapabilityDto[]>('actions');
  }

  capability(kind: CapabilityKind, id: string): Observable<FunctionDto | CapabilityDto> {
    return this.api.get<FunctionDto | CapabilityDto>(`${kind}/${encodeURIComponent(id)}`);
  }

  saveCapability(
    kind: CapabilityKind,
    id: string | null,
    request: CapabilityRequest,
  ): Observable<FunctionDto | CapabilityDto> {
    return id
      ? this.api.put<FunctionDto | CapabilityDto>(`${kind}/${encodeURIComponent(id)}`, request)
      : this.api.post<FunctionDto | CapabilityDto>(kind, request);
  }

  saveFunctionActions(
    id: string,
    version: string,
    activeActionIds: readonly string[],
  ): Observable<FunctionDto> {
    return this.api.put<FunctionDto>(`functions/${encodeURIComponent(id)}/actions`, {
      version,
      activeActionIds,
    });
  }

  deleteCapability(kind: CapabilityKind, id: string, version: string): Observable<void> {
    return this.api.delete<void>(`${kind}/${encodeURIComponent(id)}`, { version });
  }
}
