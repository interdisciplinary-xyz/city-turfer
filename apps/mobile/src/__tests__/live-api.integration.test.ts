/**
 * Live API check: the phone's real sign-in, backup and restore code against a REAL API server (not the
 * FakeApiServer). Skipped unless CITYTURFER_LIVE_API names one, so `pnpm test` and CI never hit the network.
 *
 *   AUTH_FIXED_CODE=123456 pnpm --filter @cityturfer/api dev
 *   CITYTURFER_LIVE_API=http://localhost:8787 npx jest src/__tests__/live-api.integration.test.ts
 *
 * Fixed codes only work for *@e2e.cityturfer.test addresses (after POST /v1/auth/codes).
 */
import { createFetchApiClient } from '@/contexts/cloud-backup/infrastructure/fetch-api-client';
import { nodeSha256 } from '@/contexts/cloud-backup/test-support/fake-api-server';
import { ApiAuthGateway } from '@/contexts/identity/infrastructure/api-auth-gateway';
import { migrate } from '@/platform/migrations';
import type { TrackPoint } from '@/shared-kernel';
import { loadFixes } from '@/test-support/fixtures';
import { openNodeDatabase } from '@/test-support/node-database';
import { type DeviceAdapters, wire } from '@/wiring';

const BASE = process.env.CITYTURFER_LIVE_API;
const describeLive = BASE ? describe : describe.skip;
const CODE = process.env.CITYTURFER_LIVE_CODE ?? '123456';

interface Exchange {
  method: string;
  path: string;
  status: number;
}

/** fetch that records every exchange with the API (method, path, status; never bodies). */
function recordingFetch(log: Exchange[]): typeof fetch {
  return async (input, init) => {
    const res = await fetch(input, init);
    log.push({ method: init?.method ?? 'GET', path: new URL(String(input)).pathname, status: res.status });
    return res;
  };
}

const points = (gpx: string): TrackPoint[] =>
  loadFixes(gpx).map((f) => ({ ...f, segment: 0, accuracy: 5, speed: null }));

async function signIn(address: string, log: Exchange[]) {
  const gateway = new ApiAuthGateway({
    baseUrl: BASE!,
    client: 'ios/live-test',
    timeoutMs: 20_000,
    fetchImpl: recordingFetch(log),
  });
  expect(await gateway.requestCode({ value: address })).toEqual({ kind: 'sent' });
  const r = await gateway.verifyCode({ value: address }, CODE);
  if (r.kind !== 'verified') {
    throw new Error(`sign-in failed: ${r.kind}`);
  }
  return { gateway, session: r.session };
}

async function phone(address: string, profile: string) {
  const log: Exchange[] = [];
  const { gateway, session } = await signIn(address, log);
  const db = openNodeDatabase();
  await migrate(db);
  let n = 0;
  const adapters: DeviceAdapters = {
    tracker: {
      start: async () => undefined,
      stop: async () => undefined,
      isRunning: async () => false,
      reacquire: async () => null,
    },
    permissions: { ensureForeground: async () => 'granted' as const, requestBackground: async () => true },
    notifier: { publish: () => undefined },
    router: { route: async () => null },
    ids: { next: () => `${profile}-${++n}` },
    timeZone: () => 'Europe/Warsaw',
    cloudBackup: {
      api: createFetchApiClient({
        client: 'ios/live-test',
        timeoutMs: 20_000,
        uploadTimeoutMs: 60_000,
        fetchImpl: recordingFetch(log),
      }),
      tokens: () => ({ read: async () => null, save: async () => undefined, clear: async () => undefined }),
      credentials: () => ({ current: async () => ({ token: session.token, accountId: session.account.id }) }),
      sha256: nodeSha256,
      serverUrl: BASE!,
    },
  };
  const c = wire(profile, db, adapters);
  return { c, log, gateway, session };
}

async function snapshot(c: Awaited<ReturnType<typeof phone>>['c']) {
  const list = await c.activityLog.list.execute(100);
  const details = await Promise.all(list.map((x) => c.activityLog.detail.execute(x.id)));
  return {
    activities: details
      .map((d) => ({ id: d!.id, type: d!.type, name: d!.name, distanceM: d!.distanceM, points: d!.track.length }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    cells: (await c.territory.summary.execute()).cellCount,
    homeCity: await c.territory.homeCityChoice.execute(),
  };
}

describeLive('live API: sign-in, backup, restore', () => {
  jest.setTimeout(120_000);

  it('phone A backs up, phone B restores the same history; rename propagates; account deletion revokes', async () => {
    const address = `live-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.cityturfer.test`;
    const a = await phone(address, 'phone-a');

    await a.c.activityLog.importActivity.execute({ id: 'rec-walk', type: 'walk', points: points('walk-2k.gpx') });
    await a.c.activityLog.importActivity.execute({
      id: 'rec-run',
      type: 'run',
      points: points('run-5k-outliers-pause.gpx'),
    });
    await a.c.activityLog.importActivity.execute({ id: 'rec-ride', type: 'cycle', points: points('cycle-20k.gpx') });
    await a.c.dispatcher.dispatchPending();
    await a.c.activityLog.rename.execute('rec-run', 'Riverside 5k');
    await a.c.territory.chooseHomeCity.execute('pl-warsaw');
    await a.c.dispatcher.dispatchPending();

    expect(await a.c.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
    const run = await a.c.cloudBackup.run.execute({ now: true });
    expect(run).toMatchObject({ kind: 'done', report: { uploaded: 3, failed: 0, refused: 0, error: null } });
    expect(await a.c.cloudBackup.status.execute()).toMatchObject({ backedUp: 3, total: 3 });

    // The server accepted every upload (a 422 would be a trackHash mismatch between phone and server).
    const writes = a.log.filter((x) => x.method !== 'GET' && x.path.startsWith('/v1/') && !x.path.includes('/auth/'));
    expect(writes.filter((x) => x.status >= 400)).toEqual([]);
    expect(writes.some((x) => x.method === 'PUT' && x.path.startsWith('/v1/activities/'))).toBe(true);

    // Phone B: a new phone, same account, its own sign-in.
    const b = await phone(address, 'phone-b');
    expect(await b.c.cloudBackup.restoreOffer.execute()).toEqual({ kind: 'available', count: 3 });
    expect(await b.c.cloudBackup.restore.execute()).toEqual({ kind: 'done', restored: 3, skipped: 0 });
    await b.c.dispatcher.dispatchPending();

    const mine = await snapshot(a.c);
    const theirs = await snapshot(b.c);
    expect(theirs.activities.map((x) => [x.id, x.type, x.name, x.points])).toEqual(
      mine.activities.map((x) => [x.id, x.type, x.name, x.points])
    );
    mine.activities.forEach((x, i) => expect(Math.abs(theirs.activities[i].distanceM - x.distanceM)).toBeLessThan(1));
    expect(theirs.activities.find((x) => x.id === 'rec-run')!.name).toBe('Riverside 5k');
    expect(theirs.cells).toBe(mine.cells);
    expect(theirs.cells).toBeGreaterThan(0);
    expect(theirs.homeCity).toEqual(mine.homeCity);
    expect(theirs.homeCity).not.toBeNull();
    expect(b.log.filter((x) => x.status >= 400 && !x.path.includes('/auth/'))).toEqual([]);

    // A rename on A after the restore propagates (PATCH).
    await a.c.activityLog.rename.execute('rec-walk', 'Lunch loop (renamed)');
    await a.c.dispatcher.dispatchPending();
    await a.c.cloudBackup.run.execute({ now: true });
    expect(a.log.some((x) => x.method === 'PATCH' && x.status < 300)).toBe(true);
    const res = await fetch(`${BASE}/v1/activities/rec-walk`, {
      headers: { Authorization: `Bearer ${a.session.token}` },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { name: string }).name).toBe('Lunch loop (renamed)');

    // Account deletion: the token is dead afterwards.
    expect(await a.gateway.deleteAccount(a.session.token)).toEqual({ kind: 'deleted' });
    const me = await fetch(`${BASE}/v1/me`, { headers: { Authorization: `Bearer ${a.session.token}` } });
    expect(me.status).toBe(401);
    const meB = await fetch(`${BASE}/v1/me`, { headers: { Authorization: `Bearer ${b.session.token}` } });
    expect(meB.status).toBe(401);
  });
});
