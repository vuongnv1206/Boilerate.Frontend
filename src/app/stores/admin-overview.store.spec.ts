import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error';
import { OverviewFinance, OverviewStock, OverviewWork } from '@models/admin-overview.dto';
import { AdminOverviewService } from '@services/admin-overview.service';
import { defaultAdminOverviewQuery } from '@utils/admin-overview-query.util';
import { AdminOverviewStore } from './admin-overview.store';

const work: OverviewWork = { generatedAtUtc: '2026-10-26T00:00:00Z', groups: [] };
const finance: OverviewFinance = {
  generatedAtUtc: work.generatedAtUtc,
  from: '2026-10-20',
  to: '2026-10-26',
  timeZone: 'Asia/Ho_Chi_Minh',
  currency: 'VND',
  received: '1',
  refunded: '2',
  net: '-1',
  days: [],
};
const stock: OverviewStock = {
  generatedAtUtc: work.generatedAtUtc,
  threshold: 5,
  pageNumber: 1,
  pageSize: 10,
  total: 0,
  items: [],
};
const failure = (status: number) =>
  new ApiError({ status, kind: 'network', message: 'Không tải được số liệu', fieldErrors: {} });

describe('Overview independent reads and permission changes', () => {
  let store: AdminOverviewStore;
  let access: ReturnType<typeof signal<readonly string[]>>;
  let service: {
    work: ReturnType<typeof vi.fn>;
    finance: ReturnType<typeof vi.fn>;
    stock: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    access = signal<readonly string[]>([
      'Order',
      'Renewal',
      'Inventory',
      'DigitalInventory',
      'FinancialSummary',
    ]);
    service = {
      work: vi.fn(() => of(work)),
      finance: vi.fn(() => of(finance)),
      stock: vi.fn(() => of(stock)),
    };
    TestBed.configureTestingModule({
      providers: [
        AdminOverviewStore,
        { provide: AdminOverviewService, useValue: service },
        { provide: AuthSession, useValue: { can: (code: string) => access().includes(code) } },
      ],
    });
    store = TestBed.inject(AdminOverviewStore);
    TestBed.tick();
    store.applyQuery(defaultAdminOverviewQuery('2026-10-26'));
  });
  afterEach(() => TestBed.resetTestingModule());

  it('reloads only the section affected by a URL filter and cancels older responses', () => {
    const pending = new Subject<OverviewFinance>();
    service.finance.mockReturnValueOnce(pending);
    store.applyQuery({ ...store.query(), from: '2026-10-21' });
    store.applyQuery({ ...store.query(), from: '2026-10-22' });
    pending.next({ ...finance, received: '999' });
    expect(store.finance().data?.received).toBe('1');
    expect(service.work).toHaveBeenCalledTimes(1);
    expect(service.stock).toHaveBeenCalledTimes(1);
  });

  it('keeps successful sections when another fails and can retry it independently', () => {
    service.finance.mockReturnValueOnce(throwError(() => failure(500)));
    store.reloadFinance();
    expect(store.finance().error).toBeTruthy();
    expect(store.work().data).toEqual(work);
    expect(store.stock().data).toEqual(stock);
    store.reloadFinance();
    expect(store.finance().error).toBe('');
    expect(service.work).toHaveBeenCalledTimes(1);
  });

  it('clears forbidden cached finance immediately and allows an explicit successful retry', () => {
    service.finance.mockReturnValueOnce(throwError(() => failure(403)));
    store.reloadFinance();
    expect(store.finance().data).toBeNull();
    expect(store.financeVisible()).toBe(false);
    store.refresh();
    expect(store.financeVisible()).toBe(true);
  });

  it('cancels cached mixed work and stock when just one contributing permission is revoked', () => {
    const nextWork = new Subject<OverviewWork>();
    const nextStock = new Subject<OverviewStock>();
    service.work.mockReturnValueOnce(nextWork);
    service.stock.mockReturnValueOnce(nextStock);
    access.set(['Renewal', 'DigitalInventory', 'FinancialSummary']);
    TestBed.tick();
    expect(store.work().data).toBeNull();
    expect(store.stock().data).toBeNull();
    expect(service.work).toHaveBeenCalledTimes(2);
    expect(service.stock).toHaveBeenCalledTimes(2);
    expect(store.finance().data).toEqual(finance);
    access.set(['FinancialSummary']);
    TestBed.tick();
    nextWork.next(work);
    nextStock.next(stock);
    expect(store.work().data).toBeNull();
    expect(store.stock().data).toBeNull();
    expect(store.workVisible()).toBe(false);
  });

  it('does not request unauthorized sections on refresh and erases revoked finance', () => {
    access.set(['FinancialSummary']);
    TestBed.tick();
    store.refresh();
    expect(service.work).toHaveBeenCalledTimes(1);
    expect(service.stock).toHaveBeenCalledTimes(1);
    access.set(['Order']);
    TestBed.tick();
    expect(store.finance().data).toBeNull();
    expect(store.financeVisible()).toBe(false);
  });
});
