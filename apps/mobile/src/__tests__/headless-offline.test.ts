/**
 * The background location task never talks to the server: a headless launch (app not in the
 * foreground) with backup on and an account signed in records, finishes and dispatches events
 * without a single request, without reading the account's credentials and without the router.
 */
import type { Fix } from '@/contexts/recording/domain/fix';
import { createLocationBatchHandler } from '@/contexts/recording/infrastructure/location-batch-handler';
import { phone, walk } from '@/test-support/backup-phone';

const T0 = Date.parse('2026-10-20T07:00:00Z');
const fixes = (from: number, to: number): Fix[] =>
  Array.from({ length: to - from }, (_, k) => ({
    lat: 52.2 + ((from + k) * 5) / 111_195,
    lon: 21,
    t: T0 + (from + k) * 1000,
    accuracy: 5,
    alt: null,
    speed: 3,
  }));

describe('headless launches stay offline', () => {
  it('records and finishes an activity in the background: no request, no token read, no router', async () => {
    const t = phone({ account: { token: 'secret-token', accountId: 'acct-1' }, gapRouting: true });
    const c = await t.container();
    await c.add('rec-0', walk(0));
    expect(await c.cloudBackup.enable.execute()).toEqual({ kind: 'ok' });
    await c.cloudBackup.run.execute();
    const requests = t.server.requests.length;
    const reads = t.account.reads;
    const routed = t.routerCalls.n;

    t.app.foreground = false; // the OS launched us to deliver locations
    await c.recording.start.execute('run');
    const handle = createLocationBatchHandler<Fix>({
      getContainer: async () => c,
      stopTracking: async () => undefined,
      toFix: (f) => f,
      describe: (source, l) => ({ source, received: l.length }),
      timeoutMs: 1000,
      warn: () => undefined,
    });
    await handle('task', fixes(0, 60));
    await c.recording.finish.execute();
    await c.dispatcher.dispatchPending();
    await c.estimateGaps();
    await new Promise((r) => setTimeout(r, 20));

    expect((await c.activityLog.list.execute()).length).toBe(2);
    expect(t.server.requests.length).toBe(requests);
    expect(t.account.reads).toBe(reads);
    expect(t.routerCalls.n).toBe(routed);
    // Queued, and sent once the Turfer opens the app.
    t.app.foreground = true;
    await c.backUp();
    expect(t.server.uploads()).toHaveLength(2);
  });
});
