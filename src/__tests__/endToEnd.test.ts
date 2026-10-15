import type { Fix } from '@/contexts/recording/domain/Fix';
import { migrate } from '@/platform/migrations';
import { loadFixes } from '@/test-support/fixtures';
import { openNodeDatabase } from '@/test-support/nodeDatabase';
import { wire } from '@/wiring';

function fakes() {
  let running = false;
  let n = 0;
  let now = Date.parse('2026-01-01T07:00:00Z');
  return {
    tracker: {
      start: async () => void (running = true),
      stop: async () => void (running = false),
      isRunning: async () => running,
    },
    permissions: { ensureForeground: async () => 'granted' as const, requestBackground: async () => true },
    notifier: { publish: () => undefined },
    ids: { next: () => `id-${++n}` },
    clock: { now: () => now },
    advance: (ms: number) => void (now += ms),
    isRunning: () => running,
  };
}

async function setup() {
  const db = openNodeDatabase();
  await migrate(db);
  const f = fakes();
  return { c: wire('test', db, f), f, db };
}

async function recordFixture(c: ReturnType<typeof wire>, fixes: Fix[], type: 'walk' | 'run' | 'cycle' = 'run') {
  const started = await c.recording.start.execute(type);
  expect(started.kind).toBe('started');
  for (let i = 0; i < fixes.length; i += 25) await c.recording.ingestFixes.execute(fixes.slice(i, i + 25));
  const finished = await c.recording.finish.execute();
  expect(finished.kind).toBe('finished');
  await c.dispatcher.dispatchPending();
  return (finished as { sessionId: string }).sessionId;
}

describe('Recording → Activity Log → Territory', () => {
  it('turns a finished session into an activity and claims turf', async () => {
    const { c, f } = await setup();
    const id = await recordFixture(c, loadFixes('run-5k-outliers-pause.gpx'));
    expect(f.isRunning()).toBe(false);

    const detail = await c.activityLog.detail.execute(id);
    expect(detail).not.toBeNull();
    expect(Math.abs(detail!.distanceM - 5240) / 5240).toBeLessThan(0.03);
    expect(detail!.splits.length).toBe(5);

    const claim = await c.territory.claimOf.execute(id);
    expect(claim!.cellCount).toBeGreaterThan(50);
    expect(claim!.newCellCount).toBe(claim!.cellCount); // first activity: everything is new

    const summary = await c.territory.summary.execute();
    expect(summary.cellCount).toBe(claim!.cellCount);
    expect(summary.areaKm2).toBeGreaterThan(0.1);

    // Recording purged its copy once the activity log owned the track.
    expect(await c.recording.finishedTrack.execute(id)).toEqual([]);
  });

  it('reinforces cells on a repeated route and releases exactly that turf on delete', async () => {
    const { c } = await setup();
    const fixes = loadFixes('walk-2k.gpx');
    const first = await recordFixture(c, fixes, 'walk');
    const before = await c.territory.summary.execute();
    const shifted = fixes.map((x) => ({ ...x, t: x.t + 86_400_000 }));
    const second = await recordFixture(c, shifted, 'walk');

    const claim2 = await c.territory.claimOf.execute(second);
    expect(claim2!.newCellCount).toBe(0); // same route: all reinforced
    const cells = await c.territory.viewport.execute([20.9, 52.1, 21.1, 52.3], 16);
    expect(Math.max(...cells.map((x) => x.visits))).toBe(2);

    await c.activityLog.remove.execute(second);
    await c.dispatcher.dispatchPending();
    const after = await c.territory.summary.execute();
    expect(after.cellCount).toBe(before.cellCount);
    const cellsAfter = await c.territory.viewport.execute([20.9, 52.1, 21.1, 52.3], 16);
    expect(Math.max(...cellsAfter.map((x) => x.visits))).toBe(1);
    expect(await c.activityLog.detail.execute(first)).not.toBeNull();
  });

  it('completes the chain after a crash between Finish and the activity being written', async () => {
    const { c, db } = await setup();
    await c.recording.start.execute('walk');
    await c.recording.ingestFixes.execute(loadFixes('walk-2k.gpx').slice(0, 200));
    // Simulate the process dying right after Finish committed: no dispatch.
    const handlerless = wire('test', db, fakes());
    const res = await c.recording.finish.execute();
    const id = (res as { sessionId: string }).sessionId;
    // "Next launch": a fresh container dispatches pending outbox events.
    await handlerless.dispatcher.dispatchPending();
    expect(await handlerless.activityLog.detail.execute(id)).not.toBeNull();
    expect(await handlerless.territory.claimOf.execute(id)).not.toBeNull();
  });

  it('is idempotent when the same event is delivered twice', async () => {
    const { c } = await setup();
    const id = await recordFixture(c, loadFixes('walk-2k.gpx'), 'walk');
    await c.activityLog.recordFromSession.execute({ sessionId: id, activityType: 'walk', startedAt: 0, endedAt: 1 });
    await c.territory.claimFromActivity.execute({ activityId: id, activityType: 'walk', startedAt: 0 });
    expect((await c.activityLog.list.execute()).length).toBe(1);
    const cells = await c.territory.viewport.execute([20.9, 52.1, 21.1, 52.3], 16);
    expect(Math.max(...cells.map((x) => x.visits))).toBe(1);
  });

  it('refuses to start a second session and recovers an orphaned tracker', async () => {
    const { c, f } = await setup();
    await c.recording.start.execute('run');
    expect((await c.recording.start.execute('walk')).kind).toBe('already-active');
    await f.tracker.stop();
    expect((await c.recording.recover.execute()).kind).toBe('resumed-tracking');
    expect(f.isRunning()).toBe(true);
  });
});
