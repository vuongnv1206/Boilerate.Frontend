import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '@core/auth/auth-session';
import { ApiError } from '@core/http/api-error';
import { RenewalDetail } from '@features/renewals/renewal-detail.component';
import { RenewalAdminDto, RenewalOutcome, RenewalStatus } from '@models/renewal.dto';
import { RenewalsService } from '@services/renewals.service';
import { RenewalsStore } from '@stores/renewals.store';

const renewal = (status = RenewalStatus.Ready, version = 'r1'): RenewalAdminDto => ({
  renewal: {
    id: 'renewal-a',
    orderId: 'order-a',
    orderItemId: 'line-a',
    version,
    status,
    name: 'Gia hạn gói Pro',
    sku: 'PRO-1M',
    optionDescription: '1 tháng',
    quantity: 1,
    targetPreview: 'acc***23',
    completedAtUtc: null,
    verifiedExpiresAtUtc: null,
  },
  claimedBy: null,
  claimUntilUtc: null,
  claimToken: null,
  attempts: [],
});

const pending = (): RenewalAdminDto => ({
  ...renewal(RenewalStatus.PendingVerification, 'r3'),
  attempts: [
    {
      id: 'attempt-a',
      operationId: 'started-op',
      startedBy: 'operator-a',
      startedAtUtc: '2026-10-21T08:00:00Z',
      outcome: RenewalOutcome.Pending,
      verifiedBy: null,
      verifiedAtUtc: null,
      newExpiresAtUtc: null,
    },
  ],
});
const verifiedAttempt = {
  id: 'attempt-a',
  operationId: 'started-op',
  startedBy: 'operator-a',
  startedAtUtc: '2026-10-21T08:00:00Z',
  outcome: RenewalOutcome.Pending,
  verifiedBy: null,
  verifiedAtUtc: null,
  newExpiresAtUtc: null,
} as const;

const networkFailure = () =>
  new ApiError({ status: 0, kind: 'network', message: 'Kết nối bị gián đoạn', fieldErrors: {} });

describe('Renewal detail commands and retained requests', () => {
  let fixture: ComponentFixture<RenewalDetail>;
  let screen: RenewalDetail;
  let store: RenewalsStore;
  let service: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    history: ReturnType<typeof vi.fn>;
    claim: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    verify: ReturnType<typeof vi.fn>;
    revealTarget: ReturnType<typeof vi.fn>;
    revealEvidence: ReturnType<typeof vi.fn>;
  };
  const grants = signal(
    new Set(['Renewal.View', 'Renewal.Process', 'Renewal.Verify', 'Renewal.Reveal', 'Order.View']),
  );

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    grants.set(
      new Set([
        'Renewal.View',
        'Renewal.Process',
        'Renewal.Verify',
        'Renewal.Reveal',
        'Order.View',
      ]),
    );
    service = {
      list: vi.fn(() => of({ items: [], total: 0, pageNumber: 1, pageSize: 20 })),
      get: vi.fn(() => of(renewal())),
      history: vi.fn(() => of([])),
      claim: vi.fn(() =>
        of({
          ...renewal(RenewalStatus.Claimed, 'r2'),
          claimedBy: 'operator-a',
          claimUntilUtc: '2026-10-21T10:00:00Z',
          claimToken: 'token-a',
        }),
      ),
      release: vi.fn(() => of(renewal(RenewalStatus.Ready, 'r3'))),
      start: vi.fn(() => of(pending())),
      verify: vi.fn(() =>
        of({
          ...renewal(RenewalStatus.Completed, 'r4'),
          attempts: [
            {
              ...verifiedAttempt,
              outcome: RenewalOutcome.Applied,
              verifiedBy: 'operator-b',
              verifiedAtUtc: '2026-10-21T09:00:00Z',
              newExpiresAtUtc: '2026-11-21T09:00:00Z',
            },
          ],
        }),
      ),
      revealTarget: vi.fn(() => of({ id: 'renewal-a', content: 'account-123' })),
      revealEvidence: vi.fn(() => of({ id: 'attempt-a', content: 'evidence' })),
    };
    TestBed.configureTestingModule({
      imports: [RenewalDetail],
      providers: [
        RenewalsStore,
        { provide: RenewalsService, useValue: service },
        {
          provide: AuthSession,
          useValue: {
            can: (functionCode: string, actionCode: string) =>
              grants().has(`${functionCode}.${actionCode}`),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'renewal-a' })) },
        },
      ],
    });
    TestBed.overrideComponent(RenewalDetail, { set: { template: '', imports: [] } });
    fixture = TestBed.createComponent(RenewalDetail);
    screen = fixture.componentInstance;
    store = TestBed.inject(RenewalsStore);
    await settle();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('claims with the current version and exposes the holder token only after confirmation', async () => {
    screen.claim();
    await settle();
    expect(service.claim).toHaveBeenCalledWith('renewal-a', {
      version: 'r1',
      operationId: expect.any(String),
    });
    expect(store.detail()?.renewal.status).toBe(RenewalStatus.Claimed);
    expect(store.detail()?.claimToken).toBe('token-a');
  });

  it('replays the exact start payload after a lost response', async () => {
    service.get.mockReturnValue(
      of({
        ...renewal(RenewalStatus.Claimed, 'r2'),
        claimedBy: 'operator-a',
        claimUntilUtc: '2030-10-21T10:00:00Z',
        claimToken: 'token-a',
      }),
    );
    store.loadDetail('renewal-a');
    await settle();
    service.start
      .mockReturnValueOnce(throwError(() => networkFailure()))
      .mockReturnValueOnce(of(pending()));
    screen.start();
    await settle();
    const original = service.start.mock.calls[0]?.[1];
    expect(screen.pendingCommand()?.kind).toBe('start');
    expect(store.commandFailure()).toBe('uncertain');
    screen.retry();
    await settle();
    expect(service.start).toHaveBeenCalledTimes(2);
    expect(service.start.mock.calls[1]?.[1]).toEqual(original);
    expect(store.detail()?.renewal.status).toBe(RenewalStatus.PendingVerification);
    expect(screen.pendingCommand()).toBeNull();
  });

  it('saves the actual expiry and evidence for a pending attempt', async () => {
    service.get.mockReturnValue(of(pending()));
    store.loadDetail('renewal-a');
    await settle();
    screen.applied.set(true);
    screen.newExpiresAt.set('2027-02-03T04:05');
    screen.note.set('Đối chiếu trên tài khoản');
    screen.evidence.set('Mã giao dịch đã che');
    screen.dirty.set(true);
    screen.verify();
    await settle();
    const request = service.verify.mock.calls[0]?.[1];
    expect(request).toMatchObject({
      version: 'r3',
      attemptId: 'attempt-a',
      applied: true,
      newExpiresAtUtc: new Date('2027-02-03T04:05').toISOString(),
      note: 'Đối chiếu trên tài khoản',
      evidence: 'Mã giao dịch đã che',
    });
    expect(request.operationId).toEqual(expect.any(String));
    expect(store.detail()?.renewal.status).toBe(RenewalStatus.Completed);
    expect(screen.dirty()).toBe(false);
  });

  it('does not issue or replay processing commands without their capability', () => {
    grants.set(new Set(['Renewal.View']));
    screen.claim();
    store
      .execute('renewal-a', { kind: 'claim', request: { version: 'r1', operationId: 'op-a' } })
      .subscribe();
    expect(service.claim).not.toHaveBeenCalled();
  });

  it('requires a future expiry when the operator marks a renewal applied', async () => {
    service.get.mockReturnValue(of(pending()));
    store.loadDetail('renewal-a');
    await settle();
    screen.note.set('Đã xác minh');
    screen.newExpiresAt.set('2020-01-01T00:00');
    expect(screen.verifyCanSubmit()).toBe(false);
    screen.applied.set(false);
    expect(screen.verifyCanSubmit()).toBe(true);
  });
});
