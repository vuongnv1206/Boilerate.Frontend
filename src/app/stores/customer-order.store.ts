import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, Subscription, catchError, map, of, tap, throwError } from 'rxjs';
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
  private readonly reads: Partial<
    Record<'list' | 'order' | 'deliveries' | 'shipments' | 'settings' | 'access', Subscription>
  > = {};
  private readonly deliveriesLoadingState = signal(false);
  private readonly deliveriesErrorState = signal('');
  private readonly shipmentsLoadingState = signal(false);
  private readonly shipmentsErrorState = signal('');
  private readonly settingsLoadingState = signal(false);
  private readonly settingsErrorState = signal('');
  private readonly detailLoadingState = signal(false);
  private readonly detailErrorState = signal('');
  private readonly commandErrorState = signal('');
  readonly deliveriesLoading = this.deliveriesLoadingState.asReadonly();
  readonly deliveriesError = this.deliveriesErrorState.asReadonly();
  readonly shipmentsLoading = this.shipmentsLoadingState.asReadonly();
  readonly shipmentsError = this.shipmentsErrorState.asReadonly();
  readonly settingsLoading = this.settingsLoadingState.asReadonly();
  readonly settingsError = this.settingsErrorState.asReadonly();
  readonly detailLoading = this.detailLoadingState.asReadonly();
  readonly detailError = this.detailErrorState.asReadonly();
  readonly commandError = this.commandErrorState.asReadonly();
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

  restoreGuestAccess(page?: number) {
    this.reads.access?.unsubscribe();
    this.reads.access = this.orderService
      .getVerifiedEmail()
      .pipe(
        tap((result) => {
          this.verifiedEmailState.set(result.email);
          if (page !== undefined) this.loadMyOrders(page);
        }),
        catchError(() => {
          this.resetGuestAccess();
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
    this.reads.access?.unsubscribe();
    this.reads.list?.unsubscribe();
    this.stopOrderReads();
    this.myOrdersState.set(EMPTY_PAGE);
    this.loadingState.set(false);
    this.verifiedEmailState.set(null);
    this.codeSentState.set(false);
  }

  loadPaymentSettings() {
    this.reads.settings?.unsubscribe();
    this.settingsLoadingState.set(true);
    this.settingsErrorState.set('');
    this.paymentSettingsState.set(null);
    this.reads.settings = this.orderService
      .getPaymentSettings()
      .pipe(
        tap((settings) => {
          this.paymentSettingsState.set(settings);
          this.settingsLoadingState.set(false);
        }),
        catchError((err: unknown) => {
          this.settingsLoadingState.set(false);
          this.settingsErrorState.set(normalizeApiError(err).message);
          return of(null);
        }),
      )
      .subscribe();
  }

  loadMyOrders(page = 1, size = 20) {
    this.reads.list?.unsubscribe();
    this.loadingState.set(true);
    this.errorState.set('');
    this.reads.list = this.orderService
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
    this.detailLoadingState.set(true);
    this.detailErrorState.set('');
    this.stopOrderReads();
    this.commandErrorState.set('');
    this.currentOrderState.set(null);
    this.digitalDeliveriesState.set([]);
    this.shipmentsState.set([]);

    this.reads.order = this.orderService
      .getOrder(id)
      .pipe(
        tap((order) => {
          this.currentOrderState.set(order);
          this.detailLoadingState.set(false);

          if (order.paymentStatus === OrderPaymentStatus.Paid) {
            this.loadDeliveries(id);
          }
          this.loadShipments(id);
        }),
        catchError((err: unknown) => {
          this.detailErrorState.set(normalizeApiError(err).message);
          this.detailLoadingState.set(false);
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
    if (this.submittingState()) return;
    this.submittingState.set(true);
    this.commandErrorState.set('');
    this.orderService
      .cancelOrder(id, version)
      .pipe(
        tap((updated) => {
          if (this.currentOrderState()?.id === id) this.currentOrderState.set(updated);
          this.submittingState.set(false);
        }),
        catchError((err: unknown) => {
          this.commandErrorState.set(normalizeApiError(err).message);
          this.submittingState.set(false);
          return of(null);
        }),
      )
      .subscribe();
  }

  stopOrderReads(): void {
    for (const key of ['order', 'deliveries', 'shipments'] as const) this.reads[key]?.unsubscribe();
    this.currentOrderState.set(null);
    this.digitalDeliveriesState.set([]);
    this.shipmentsState.set([]);
    this.deliveriesLoadingState.set(false);
    this.shipmentsLoadingState.set(false);
    this.deliveriesErrorState.set('');
    this.shipmentsErrorState.set('');
  }

  stopListReads(): void {
    this.reads.list?.unsubscribe();
    this.reads.access?.unsubscribe();
  }

  loadDeliveries(orderId: string): void {
    this.reads.deliveries?.unsubscribe();
    this.deliveriesLoadingState.set(true);
    this.deliveriesErrorState.set('');
    this.reads.deliveries = this.orderService
      .getDigitalDeliveries(orderId)
      .pipe(
        tap((deliveries) => {
          this.digitalDeliveriesState.set(deliveries);
          this.deliveriesLoadingState.set(false);
        }),
        catchError((err: unknown) => {
          this.deliveriesLoadingState.set(false);
          this.deliveriesErrorState.set(normalizeApiError(err).message);
          return of([]);
        }),
      )
      .subscribe();
  }

  loadShipments(orderId: string): void {
    this.reads.shipments?.unsubscribe();
    this.shipmentsLoadingState.set(true);
    this.shipmentsErrorState.set('');
    this.reads.shipments = this.orderService
      .getMyShipments(orderId)
      .pipe(
        tap((shipments) => {
          this.shipmentsState.set(shipments);
          this.shipmentsLoadingState.set(false);
        }),
        catchError((err: unknown) => {
          this.shipmentsLoadingState.set(false);
          this.shipmentsErrorState.set(normalizeApiError(err).message);
          return of([]);
        }),
      )
      .subscribe();
  }
}
