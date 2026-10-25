import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { normalizeApiError } from '@core/http/normalize-api-error';
import { CheckoutRequest } from '@models/checkout.dto';
import { DigitalDeliveryDto } from '@models/digital-delivery.dto';
import { OrderDto, OrderPage, OrderPaymentStatus, ShipmentSummary } from '@models/order.dto';
import { CustomerOrdersService } from '@services/customer-orders.service';
import { GuestPaymentSettings } from '@models/storefront-settings.dto';

const EMPTY_PAGE: OrderPage = {
  items: [],
  total: 0,
  pageNumber: 1,
  pageSize: 20,
};

@Injectable({ providedIn: 'root' })
export class CustomerOrderStore {
  private readonly orderService = inject(CustomerOrdersService);

  private readonly myOrdersState = signal<OrderPage>(EMPTY_PAGE);
  private readonly currentOrderState = signal<OrderDto | null>(null);
  private readonly digitalDeliveriesState = signal<readonly DigitalDeliveryDto[]>([]);
  private readonly shipmentsState = signal<readonly ShipmentSummary[]>([]);
  private readonly loadingState = signal(false);
  private readonly submittingState = signal(false);
  private readonly quoteConflictState = signal(false);
  private readonly errorState = signal('');
  private readonly verifiedEmailState = signal<string | null>(null);
  private readonly codeSentState = signal(false);
  private readonly accessSubmittingState = signal(false);
  private readonly paymentSettingsState = signal<GuestPaymentSettings | null>(null);

  readonly myOrders = this.myOrdersState.asReadonly();
  readonly currentOrder = this.currentOrderState.asReadonly();
  readonly digitalDeliveries = this.digitalDeliveriesState.asReadonly();
  readonly shipments = this.shipmentsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly submitting = this.submittingState.asReadonly();
  readonly quoteConflict = this.quoteConflictState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly verifiedEmail = this.verifiedEmailState.asReadonly();
  readonly codeSent = this.codeSentState.asReadonly();
  readonly accessSubmitting = this.accessSubmittingState.asReadonly();
  readonly paymentSettings = this.paymentSettingsState.asReadonly();

  readonly hasDigitalDeliveries = computed(() => this.digitalDeliveriesState().length > 0);
  readonly isPaid = computed(
    () => this.currentOrderState()?.paymentStatus === OrderPaymentStatus.Paid,
  );

  restoreGuestAccess() {
    this.orderService
      .getVerifiedEmail()
      .pipe(
        tap((result) => {
          this.verifiedEmailState.set(result.email);
          this.loadMyOrders();
        }),
        catchError(() => {
          this.verifiedEmailState.set(null);
          this.myOrdersState.set(EMPTY_PAGE);
          return of(null);
        }),
      )
      .subscribe();
  }

  requestAccessCode(email: string): Observable<void> {
    this.accessSubmittingState.set(true);
    this.errorState.set('');
    return this.orderService.requestAccessCode(email).pipe(
      map(() => undefined),
      tap(() => {
        this.codeSentState.set(true);
        this.accessSubmittingState.set(false);
      }),
      catchError((err: unknown) => {
        this.errorState.set(normalizeApiError(err).message);
        this.accessSubmittingState.set(false);
        return throwError(() => err);
      }),
    );
  }

  verifyAccessCode(email: string, code: string): Observable<string> {
    this.accessSubmittingState.set(true);
    this.errorState.set('');
    return this.orderService.verifyAccessCode(email, code).pipe(
      map((result) => result.email),
      tap((verifiedEmail) => {
        this.verifiedEmailState.set(verifiedEmail);
        this.codeSentState.set(false);
        this.accessSubmittingState.set(false);
      }),
      catchError((err: unknown) => {
        this.errorState.set(normalizeApiError(err).message);
        this.accessSubmittingState.set(false);
        return throwError(() => err);
      }),
    );
  }

  resetGuestAccess() {
    this.verifiedEmailState.set(null);
    this.codeSentState.set(false);
  }

  loadPaymentSettings() {
    this.orderService
      .getPaymentSettings()
      .pipe(
        tap((settings) => this.paymentSettingsState.set(settings)),
        catchError(() => {
          this.paymentSettingsState.set({
            bankName: null,
            accountNumber: null,
            accountHolder: null,
            branch: null,
            instructions: null,
            bankTransferEnabled: false,
          });
          return of(null);
        }),
      )
      .subscribe();
  }

  loadMyOrders(page = 1, size = 20) {
    this.loadingState.set(true);
    this.errorState.set('');
    this.orderService
      .getMyOrders(page, size)
      .pipe(
        tap((pageData) => {
          this.myOrdersState.set(pageData);
          this.loadingState.set(false);
        }),
        catchError((err: unknown) => {
          this.errorState.set(normalizeApiError(err).message);
          this.loadingState.set(false);
          return of(EMPTY_PAGE);
        }),
      )
      .subscribe();
  }

  loadOrder(id: string) {
    this.loadingState.set(true);
    this.errorState.set('');
    this.currentOrderState.set(null);
    this.digitalDeliveriesState.set([]);
    this.shipmentsState.set([]);

    this.orderService
      .getOrder(id)
      .pipe(
        tap((order) => {
          this.currentOrderState.set(order);
          this.loadingState.set(false);

          if (order.paymentStatus === OrderPaymentStatus.Paid) {
            this.loadDeliveries(id);
          }
          this.loadShipments(id);
        }),
        catchError((err: unknown) => {
          this.errorState.set(normalizeApiError(err).message);
          this.loadingState.set(false);
          return of(null);
        }),
      )
      .subscribe();
  }

  checkout(request: CheckoutRequest): Observable<OrderDto> {
    this.submittingState.set(true);
    this.quoteConflictState.set(false);
    this.errorState.set('');
    return this.orderService.checkout(request).pipe(
      tap((order) => {
        this.currentOrderState.set(order);
        this.submittingState.set(false);
      }),
      catchError((err: unknown) => {
        const normalizedError = normalizeApiError(err);
        this.quoteConflictState.set(normalizedError.status === 409);
        const errorMsg = normalizedError.message;
        this.errorState.set(errorMsg);
        this.submittingState.set(false);
        return throwError(() => err);
      }),
    );
  }

  cancelOrder(id: string, version: string) {
    this.submittingState.set(true);
    this.errorState.set('');
    this.orderService
      .cancelOrder(id, version)
      .pipe(
        tap((updated) => {
          this.currentOrderState.set(updated);
          this.submittingState.set(false);
        }),
        catchError((err: unknown) => {
          this.errorState.set(normalizeApiError(err).message);
          this.submittingState.set(false);
          return of(null);
        }),
      )
      .subscribe();
  }

  loadDeliveries(orderId: string) {
    this.orderService
      .getDigitalDeliveries(orderId)
      .pipe(
        tap((deliveries) => this.digitalDeliveriesState.set(deliveries)),
        catchError(() => of([])),
      )
      .subscribe();
  }

  loadShipments(orderId: string) {
    this.orderService
      .getMyShipments(orderId)
      .pipe(
        tap((shipments) => this.shipmentsState.set(shipments)),
        catchError(() => of([])),
      )
      .subscribe();
  }
}
