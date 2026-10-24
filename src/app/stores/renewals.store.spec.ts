import { TestBed } from '@angular/core/testing';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error';
import {
  RenewalAdminDto,
  RenewalContentDto,
  RenewalHistoryDto,
  RenewalOutcome,
  RenewalPage,
  RenewalStatus,
} from '@models/renewal.dto';
import { RenewalsService } from '@services/renewals.service';
import { RenewalsStore } from './renewals.store';

const record = (id = 'a', status = RenewalStatus.Ready): RenewalAdminDto => ({
  renewal: {
    id,
    orderId: `order-${id}`,
    orderItemId: `line-${id}`,
    version: `v-${status}`,
    status,
    name: `Gia hạn ${id}`,
    sku: id,
    optionDescription: '',
    quantity: 1,
    targetPreview: null,
    completedAtUtc: null,
    verifiedExpiresAtUtc: null,
  },
  claimedBy: status === RenewalStatus.Claimed ? 'operator' : null,
  claimUntilUtc: '2099-01-01T00:00:00Z',
  claimToken: status === RenewalStatus.Claimed ? 'claim-token' : null,
  attempts: [
    {
      id: 'attempt',
      operationId: 'start',
      startedBy: 'operator',
      startedAtUtc: '2026-10-21T00:00:00Z',
      outcome: RenewalOutcome.Pending,
      verifiedBy: null,
      verifiedAtUtc: null,
      newExpiresAtUtc: null,
    },
  ],
});
const entry = (operationId: string): RenewalHistoryDto => ({
  operationId,
  action: operationId,
  actorId: 'operator',
  statusAfter: RenewalStatus.Claimed,
  occurredAtUtc: '2026-10-21T00:00:00Z',
});
const page = (
  items: readonly RenewalAdminDto[] = [],
  pageNumber = 1,
  total = items.length,
): RenewalPage => ({
  items,
  total,
  pageNumber,
  pageSize: 20,
});
const failure = (status = 0) =>
  new ApiError({
    status,
    kind: status === 409 ? 'conflict' : 'network',
    message: 'Mất kết nối',
    fieldErrors: {},
  });
const command = { kind: 'claim', request: { version: 'v-2', operationId: 'claim' } } as const;

describe('RenewalsStore canonical reads and request ownership', () => {
  let store: RenewalsStore;
  let service: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    history: ReturnType<typeof vi.fn>;
    claim: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    revealTarget: ReturnType<typeof vi.fn>;
    revealEvidence: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      list: vi.fn(() => of(page())),
      get: vi.fn((id: string) => of(record(id))),
      history: vi.fn(() => of([entry('initial')])),
      claim: vi.fn(() => of(record('a', RenewalStatus.Claimed))),
      start: vi.fn(() => of(record('a', RenewalStatus.PendingVerification))),
      revealTarget: vi.fn(() => of({ id: 'a', content: 'secret' })),
      revealEvidence: vi.fn(() => of({ id: 'attempt', content: 'evidence' })),
    };
    TestBed.configureTestingModule({
      providers: [
        RenewalsStore,
        { provide: RenewalsService, useValue: service },
        { provide: AuthSession, useValue: { can: () => true } },
      ],
    });
    store = TestBed.inject(RenewalsStore);
  });
  afterEach(() => TestBed.resetTestingModule());

  it('completes an accepted command without waiting for secondary reads and refreshes the latest query', async () => {
    store.loadDetail('a');
    store.loadPage(2, RenewalStatus.Ready);
    const response = new Subject<RenewalAdminDto>();
    const history = new Subject<readonly RenewalHistoryDto[]>();
    service.claim.mockReturnValue(response);
    service.history.mockReturnValue(history);
    const result = firstValueFrom(store.execute('a', command));
    store.loadPage(3, RenewalStatus.Claimed);
    response.next(record('a', RenewalStatus.Claimed));
    response.complete();
    expect((await result).renewal.status).toBe(RenewalStatus.Claimed);
    expect(store.commandBusy()).toBe(false);
    expect(service.list).toHaveBeenLastCalledWith(3, RenewalStatus.Claimed);
    expect(store.historyLoading()).toBe(true);
    history.next([entry('claim')]);
    history.complete();
    expect(store.history().map((item) => item.operationId)).toEqual(['claim']);
  });

  it('keeps a successful mutation successful when history or list refresh fails, and retries reads only', async () => {
    store.loadDetail('a');
    service.history.mockReturnValueOnce(throwError(() => failure()));
    service.list.mockReturnValueOnce(throwError(() => failure()));
    await firstValueFrom(store.execute('a', command));
    expect(store.detail()?.renewal.status).toBe(RenewalStatus.Claimed);
    expect(store.commandFailure()).toBeNull();
    expect(store.commandError()).toBe('');
    expect(store.historyError()).toContain('Thao tác đã lưu');
    expect(store.error()).toContain('Thao tác đã lưu');
    expect(store.history()).toEqual([entry('initial')]);
    service.history.mockReturnValueOnce(of([entry('claim')]));
    store.reloadHistory();
    store.loadPage();
    expect(store.history()).toEqual([entry('claim')]);
    expect(store.historyError()).toBe('');
    expect(service.claim).toHaveBeenCalledTimes(1);
    expect(service.get).toHaveBeenCalledTimes(1);
  });

  it('loads the record even if the initial history read fails', () => {
    service.history.mockReturnValueOnce(throwError(() => failure()));
    store.loadDetail('a');
    expect(store.detail()?.renewal.id).toBe('a');
    expect(store.detailError()).toBe('');
    expect(store.historyError()).toContain('Mất kết nối');
  });

  it('ignores an old history response after another successful command', async () => {
    store.loadDetail('a');
    const older = new Subject<readonly RenewalHistoryDto[]>();
    const newer = new Subject<readonly RenewalHistoryDto[]>();
    service.history.mockReturnValueOnce(older).mockReturnValueOnce(newer);
    await firstValueFrom(store.execute('a', command));
    await firstValueFrom(
      store.execute('a', {
        kind: 'start',
        request: {
          version: 'v-3',
          operationId: 'start',
          claimToken: 'claim-token',
        },
      }),
    );
    newer.next([entry('start')]);
    newer.complete();
    older.next([entry('claim')]);
    older.complete();
    expect(store.history()).toEqual([entry('start')]);
  });

  it('does not let an old mutation or its failure replace a different record', () => {
    store.loadDetail('a');
    const response = new Subject<RenewalAdminDto>();
    service.claim.mockReturnValue(response);
    store.execute('a', command).subscribe();
    store.loadDetail('b');
    response.next(record('a', RenewalStatus.Claimed));
    response.error(failure(409));
    expect(store.detail()?.renewal.id).toBe('b');
    expect(store.commandFailure()).toBeNull();
    expect(store.commandBusy()).toBe(false);
  });

  it('retains a rejected-command marker while reading canonical data without replay', async () => {
    store.loadDetail('a');
    service.claim.mockReturnValueOnce(throwError(() => failure(409)));
    service.get.mockReturnValueOnce(of(record('a', RenewalStatus.Claimed)));
    await firstValueFrom(store.execute('a', command), { defaultValue: null });
    expect(store.detail()?.renewal.status).toBe(RenewalStatus.Claimed);
    expect(store.commandFailure()).toBe('rejected');
    expect(service.claim).toHaveBeenCalledTimes(1);
  });

  it('reconciles a filtered last page after status changes and cancels the previous page read', async () => {
    store.loadDetail('a');
    const old = new Subject<RenewalPage>();
    service.list.mockReturnValueOnce(old).mockReturnValueOnce(of(page([], 2, 20)));
    store.loadPage(2, RenewalStatus.Ready);
    await firstValueFrom(store.execute('a', command));
    expect(store.pageCorrection()).toBe(1);
    service.list.mockReturnValueOnce(of(page([record('b')], 1, 20)));
    store.loadPage(1, RenewalStatus.Ready);
    old.next(page([record('a')], 2, 21));
    expect(store.page().items.map((item) => item.renewal.id)).toEqual(['b']);
    expect(store.pageCorrection()).toBeNull();
  });

  it('invalidates pending secrets when hiding, switching records or leaving detail', () => {
    const target = new Subject<RenewalContentDto>();
    const evidence = new Subject<RenewalContentDto>();
    service.revealTarget.mockReturnValue(target);
    service.revealEvidence.mockReturnValue(evidence);
    store.loadDetail('a');
    store.revealTarget('a');
    store.revealEvidence('a', 'attempt');
    store.hideTarget();
    store.hideEvidence('attempt');
    target.next({ id: 'a', content: 'hidden target' });
    evidence.next({ id: 'attempt', content: 'hidden evidence' });
    expect(store.revealedTarget()).toBeNull();
    expect(store.revealedEvidence()).toEqual({});
    store.revealTarget('a');
    store.revealEvidence('a', 'attempt');
    store.loadDetail('b');
    target.next({ id: 'a', content: 'wrong record' });
    evidence.next({ id: 'attempt', content: 'wrong evidence' });
    expect(store.revealedTarget()).toBeNull();
    expect(store.revealedEvidence()).toEqual({});
    store.revealTarget('b');
    store.clearDetail();
    target.next({ id: 'b', content: 'after leaving' });
    expect(store.detail()).toBeNull();
    expect(store.revealedTarget()).toBeNull();
  });
});
