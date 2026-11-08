import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '@core/base';
import {
  CapabilityDto,
  CapabilityKind,
  CapabilityRequest,
  FunctionDto,
  FunctionGroupDto,
  FunctionGroupRequest,
} from '../models/identity.dto';

@Injectable({ providedIn: 'root' })
export class CapabilitiesService extends BaseApiService {
  groups(): Observable<readonly FunctionGroupDto[]> {
    return this.get<readonly FunctionGroupDto[]>('function-groups');
  }

  saveGroup(id: string | null, request: FunctionGroupRequest): Observable<FunctionGroupDto> {
    return id
      ? this.put<FunctionGroupDto>(`function-groups/${encodeURIComponent(id)}`, request)
      : this.post<FunctionGroupDto>('function-groups', request);
  }

  deleteGroup(id: string, version: string): Observable<void> {
    return this.deleteResource<void>(`function-groups/${encodeURIComponent(id)}`, { version });
  }

  functions(): Observable<readonly FunctionDto[]> {
    return this.get<readonly FunctionDto[]>('functions');
  }

  actions(): Observable<readonly CapabilityDto[]> {
    return this.get<readonly CapabilityDto[]>('actions');
  }

  capability(kind: CapabilityKind, id: string): Observable<FunctionDto | CapabilityDto> {
    return this.get<FunctionDto | CapabilityDto>(`${kind}/${encodeURIComponent(id)}`);
  }

  saveCapability(
    kind: CapabilityKind,
    id: string | null,
    request: CapabilityRequest,
  ): Observable<FunctionDto | CapabilityDto> {
    return id
      ? this.put<FunctionDto | CapabilityDto>(`${kind}/${encodeURIComponent(id)}`, request)
      : this.post<FunctionDto | CapabilityDto>(kind, request);
  }

  saveFunctionActions(
    id: string,
    version: string,
    activeActionIds: readonly string[],
  ): Observable<FunctionDto> {
    return this.put<FunctionDto>(`functions/${encodeURIComponent(id)}/actions`, {
      version,
      activeActionIds,
    });
  }

  deleteCapability(kind: CapabilityKind, id: string, version: string): Observable<void> {
    return this.deleteResource<void>(`${kind}/${encodeURIComponent(id)}`, { version });
  }
}
