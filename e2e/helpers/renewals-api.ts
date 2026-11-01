import type { BrowserContext, Route } from '@playwright/test';
import {
  RenewalAdminDto,
  RenewalHistoryDto,
  RenewalOutcome,
  RenewalStatus,
} from '../../src/app/models/renewal.dto';

export const RENEWAL_ID = '60000000-0000-0000-0000-000000000001';
export const SECOND_RENEWAL_ID = '60000000-0000-0000-0000-000000000002';
export const PENDING_RENEWAL_ID = '60000000-0000-0000-0000-000000000003';
export const RENEWAL_GRANTS = [
  'Permissions.Renewal.View',
  'Permissions.Renewal.Process',
  'Permissions.Renewal.Verify',
  'Permissions.Renewal.Reveal',
];

type FixtureRenewal = { -readonly [Key in keyof RenewalAdminDto]: RenewalAdminDto[Key] };

const initial = (id: string, name: string, status = RenewalStatus.Ready): FixtureRenewal => ({
  renewal: {
    id,
    orderId: 'order-a',
    orderItemId: `line-${id}`,
    version: 'v1',
    status,
    name,
    sku: `PRO-${id.slice(-1)}`,
    optionDescription: 'Một tháng',
    quantity: 1,
    targetPreview: 'acc***23',
    completedAtUtc: null,
    verifiedExpiresAtUtc: null,
  },
  claimedBy: null,
  claimUntilUtc: null,
  claimToken: null,
  attempts:
    status === RenewalStatus.PendingVerification
      ? [
          {
            id: 'attempt-pending',
            operationId: 'start-pending',
            startedBy: 'operator',
            startedAtUtc: '2026-10-21T08:00:00Z',
            outcome: RenewalOutcome.Pending,
            verifiedBy: null,
            verifiedAtUtc: null,
            newExpiresAtUtc: null,
          },
        ]
      : [],
});

export async function installRenewalsApi(context: BrowserContext) {
  const records = [
    initial(RENEWAL_ID, 'Gia hạn Pro'),
    initial(SECOND_RENEWAL_ID, 'Gia hạn Team'),
    initial(PENDING_RENEWAL_ID, 'Gia hạn chờ xác minh', RenewalStatus.PendingVerification),
  ];
  const history = new Map<string, RenewalHistoryDto[]>();
  const operations = new Map<string, { body: string; record: RenewalAdminDto }>();
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  const reads: string[] = [];
  let loseStart = false;
  let conflictVerify = false;
  let failHistory = false;
  let version = 1;
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const conflict = (route: Route) =>
    reply(route, { status: 409, title: 'Yêu cầu đã thay đổi' }, 409);

  await context.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.split('/api/')[1] ?? '';
    if (!path.startsWith('admin/renewals')) return route.fallback();
    const method = route.request().method();
    const id = path.split('/')[2];
    const record = records.find((item) => item.renewal.id === id);
    if (method === 'GET') {
      reads.push(path);
      if (path === 'admin/renewals') {
        const status = url.searchParams.get('status');
        const queue = url.searchParams.get('queue');
        const items = records.filter(
          (item) =>
            (status === null || item.renewal.status === Number(status)) &&
            (queue === null ||
              (queue === 'awaiting-work' &&
                [RenewalStatus.Ready, RenewalStatus.Claimed].includes(item.renewal.status)) ||
              (queue === 'pending-verification' &&
                item.renewal.status === RenewalStatus.PendingVerification)),
        );
        const pageNumber = Number(url.searchParams.get('page') ?? 1);
        return reply(route, {
          items: items.slice((pageNumber - 1) * 20, pageNumber * 20),
          total: items.length,
          pageNumber,
          pageSize: 20,
        });
      }
      if (!record) return reply(route, { status: 404 }, 404);
      if (path.endsWith('/history')) {
        if (failHistory) {
          failHistory = false;
          return reply(route, { status: 503, title: 'Chưa tải được lịch sử' }, 503);
        }
        return reply(route, history.get(id) ?? []);
      }
      if (path.endsWith('/target')) return reply(route, { id, content: `account-secret-${id}` });
      if (path.endsWith('/evidence'))
        return reply(route, { id: path.split('/')[4], content: 'evidence-secret' });
      return reply(route, record);
    }
    if (method !== 'POST' || !record) return reply(route, { status: 501 }, 501);
    const body = route.request().postDataJSON() as Record<string, unknown>;
    writes.push({ path, body });
    const action = path.split('/')[3];
    const operationId = String(body['operationId']);
    const snapshot = JSON.stringify({ path, body });
    const previous = operations.get(operationId);
    if (previous)
      return previous.body === snapshot ? reply(route, previous.record) : conflict(route);
    if (action === 'verify' && conflictVerify) {
      conflictVerify = false;
      record.renewal = { ...record.renewal, version: `v${++version}` };
      return conflict(route);
    }
    if (body['version'] !== record.renewal.version) return conflict(route);
    let saved = structuredClone(record);
    if (action === 'claim') {
      saved = {
        ...saved,
        claimedBy: 'operator',
        claimUntilUtc: new Date(Date.now() + 300_000).toISOString(),
        claimToken: 'claim-token',
      };
      saved.renewal = { ...saved.renewal, status: RenewalStatus.Claimed };
    } else if (action === 'release') {
      saved = { ...saved, claimedBy: null, claimUntilUtc: null, claimToken: null };
      saved.renewal = { ...saved.renewal, status: RenewalStatus.Ready };
    } else if (action === 'start') {
      saved.renewal = { ...saved.renewal, status: RenewalStatus.PendingVerification };
      saved.attempts = [
        ...saved.attempts,
        {
          id: `attempt-${version}`,
          operationId,
          startedBy: 'operator',
          startedAtUtc: new Date().toISOString(),
          outcome: RenewalOutcome.Pending,
          verifiedBy: null,
          verifiedAtUtc: null,
          newExpiresAtUtc: null,
        },
      ];
    } else if (action === 'verify') {
      const applied = body['applied'] === true;
      saved.renewal = {
        ...saved.renewal,
        status: applied ? RenewalStatus.Completed : RenewalStatus.Ready,
        completedAtUtc: applied ? new Date().toISOString() : null,
        verifiedExpiresAtUtc: applied ? String(body['newExpiresAtUtc']) : null,
      };
      saved.attempts = saved.attempts.map((attempt) =>
        attempt.id === body['attemptId']
          ? {
              ...attempt,
              outcome: applied ? RenewalOutcome.Applied : RenewalOutcome.NotApplied,
              verifiedBy: 'verifier',
              verifiedAtUtc: new Date().toISOString(),
              newExpiresAtUtc: applied ? String(body['newExpiresAtUtc']) : null,
            }
          : attempt,
      );
    } else return reply(route, { status: 501 }, 501);
    saved.renewal = { ...saved.renewal, version: `v${++version}` };
    records[records.indexOf(record)] = saved;
    history.set(id, [
      ...(history.get(id) ?? []),
      {
        operationId,
        action,
        actorId: 'operator',
        statusAfter: saved.renewal.status,
        occurredAtUtc: new Date().toISOString(),
      },
    ]);
    operations.set(operationId, { body: snapshot, record: structuredClone(saved) });
    if (action === 'start' && loseStart) {
      loseStart = false;
      return route.abort('failed');
    }
    return reply(route, saved);
  });
  return {
    records,
    writes,
    reads,
    history,
    loseNextStartResponse: () => {
      loseStart = true;
    },
    conflictNextVerify: () => {
      conflictVerify = true;
    },
    failNextHistory: () => {
      failHistory = true;
    },
  };
}
