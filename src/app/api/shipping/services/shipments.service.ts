import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthSession } from '@core/auth/auth-session';
import { BaseApiService } from '@core/base';
import {
  CreateShipmentRequest,
  DeliverShipmentRequest,
  DispatchShipmentRequest,
  ShipmentDto,
} from '../models/shipment.dto';

@Injectable({ providedIn: 'root' })
export class ShipmentsService extends BaseApiService {
  constructor(private readonly session: AuthSession) {
    super();
  }

  getAdminShipments(orderId: string): Observable<readonly ShipmentDto[]> {
    return this.get<readonly ShipmentDto[]>(
      `admin/orders/${encodeURIComponent(orderId)}/shipments`,
    );
  }

  createShipment(orderId: string, request: CreateShipmentRequest): Observable<ShipmentDto> {
    return this.dispatchShipment(orderId, request);
  }

  dispatchShipment(orderId: string, request: DispatchShipmentRequest): Observable<ShipmentDto> {
    return this.post<ShipmentDto>(`admin/orders/${encodeURIComponent(orderId)}/shipments`, request);
  }

  deliverShipment(
    orderId: string,
    shipmentId: string,
    request: DeliverShipmentRequest,
  ): Observable<ShipmentDto> {
    return this.post<ShipmentDto>(
      `admin/orders/${encodeURIComponent(orderId)}/shipments/${encodeURIComponent(shipmentId)}/deliver`,
      request,
    );
  }

  getCustomerShipments(orderId: string): Observable<readonly ShipmentDto[]> {
    const prefix = this.session.signedIn() ? 'orders' : 'storefront/orders';
    return this.get<readonly ShipmentDto[]>(
      `${prefix}/${encodeURIComponent(orderId)}/shipments`,
      undefined,
      { withCredentials: true },
    );
  }
}
