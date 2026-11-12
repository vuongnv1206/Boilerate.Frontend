import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { ApiService } from '@core/http/api.service';
import {
  CreateShipmentRequest,
  DeliverShipmentRequest,
  DispatchShipmentRequest,
  ShipmentDto,
} from '../models/shipment.dto';

@Injectable({ providedIn: 'root' })
export class ShipmentsService {
  constructor(
    private readonly api: ApiService,
    private readonly session: AuthSession,
  ) {}

  getAdminShipments(orderId: string): Observable<readonly ShipmentDto[]> {
    return this.api.get<readonly ShipmentDto[]>(
      `admin/orders/${encodeURIComponent(orderId)}/shipments`,
    );
  }

  createShipment(orderId: string, request: CreateShipmentRequest): Observable<ShipmentDto> {
    return this.dispatchShipment(orderId, request);
  }

  dispatchShipment(orderId: string, request: DispatchShipmentRequest): Observable<ShipmentDto> {
    return this.api.post<ShipmentDto>(
      `admin/orders/${encodeURIComponent(orderId)}/shipments`,
      request,
    );
  }

  deliverShipment(
    orderId: string,
    shipmentId: string,
    request: DeliverShipmentRequest,
  ): Observable<ShipmentDto> {
    return this.api.post<ShipmentDto>(
      `admin/orders/${encodeURIComponent(orderId)}/shipments/${encodeURIComponent(shipmentId)}/deliver`,
      request,
    );
  }

  getCustomerShipments(orderId: string): Observable<readonly ShipmentDto[]> {
    const prefix = this.session.signedIn() ? 'orders' : 'storefront/orders';
    return this.api.get<readonly ShipmentDto[]>(
      `${prefix}/${encodeURIComponent(orderId)}/shipments`,
      undefined,
      { withCredentials: true },
    );
  }
}
