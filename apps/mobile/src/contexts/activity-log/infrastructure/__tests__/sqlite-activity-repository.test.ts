import { Activity } from '@cityturfer/core/activity-log/ports';

import { migrate } from '@/platform/migrations';
import { trackFromPoints, type TrackPoint } from '@/shared-kernel';
import { openNodeDatabase } from '@/test-support/node-database';

import { SqliteActivityRepository } from '../sqlite-activity-repository';

const T0 = Date.parse('2026-01-01T07:00:00Z');
const points: TrackPoint[] = [0, 1, 2, 3].map((i) => ({
  lat: 52.2 + i * 0.001,
  lon: 21,
  t: T0 + i * 60_000,
  segment: i < 2 ? 0 : 1,
  alt: null,
  accuracy: 5,
  speed: null,
}));

async function setup() {
  const db = openNodeDatabase();
  await migrate(db);
  return { db, repo: new SqliteActivityRepository(db) };
}

const record = (resumedSegments: number[] | null) =>
  Activity.record({
    id: 'a',
    type: 'walk',
    startedAt: T0,
    endedAt: T0 + 180_000,
    track: trackFromPoints(points),
    now: T0,
    resumedSegments,
  });

describe('SqliteActivityRepository: why segments start', () => {
  it('keeps the segments begun by a manual Resume (no schema change)', async () => {
    const { repo } = await setup();
    await repo.save(record([1]), points);
    const a = (await repo.get('a'))!.toState();
    expect(a.resumedSegments).toEqual([1]);
    expect(a.summary.splits).toEqual(record([1]).toState().summary.splits);
  });

  it('keeps "unknown" as null, also through a rename', async () => {
    const { repo } = await setup();
    await repo.save(record(null), points);
    expect((await repo.get('a'))!.toState().resumedSegments).toBeNull();
    const a = (await repo.get('a'))!;
    a.rename('Lunch walk', T0);
    await repo.save(a);
    expect((await repo.get('a'))!.toState()).toMatchObject({ name: 'Lunch walk', resumedSegments: null });
  });

  it('reads rows written before this change (splits stored as a bare array) as unknown', async () => {
    const { db, repo } = await setup();
    await repo.save(record([1]), points);
    await db.run(`UPDATE log_activities SET splits = '[{"km":1,"seconds":600}]' WHERE id = 'a'`);
    const a = (await repo.get('a'))!.toState();
    expect(a.summary.splits).toEqual([{ km: 1, seconds: 600 }]);
    expect(a.resumedSegments).toBeNull();
  });
});

describe('SqliteActivityRepository: gap routes check time', () => {
  it('is null until the gaps are estimated, then the estimate time; null for an unknown id', async () => {
    const { repo } = await setup();
    await repo.save(record(null), points);
    expect(await repo.gapsCheckedAt('a')).toBeNull();
    await repo.saveGapRoutes('a', [], T0 + 5_000);
    expect(await repo.gapsCheckedAt('a')).toBe(T0 + 5_000);
    expect(await repo.gapsCheckedAt('nope')).toBeNull();
  });
});

describe('SqliteActivityRepository: timeline', () => {
  it('lists id, start and end of every activity, oldest first', async () => {
    const { repo } = await setup();
    const later = Activity.record({
      id: 'b',
      type: 'run',
      startedAt: T0 + 86_400_000,
      endedAt: T0 + 86_580_000,
      track: trackFromPoints(points.map((p) => ({ ...p, t: p.t + 86_400_000 }))),
      now: T0,
    });
    await repo.save(later, points);
    await repo.save(record(null), points);
    expect(await repo.timeline()).toEqual([
      { id: 'a', startedAt: T0, endedAt: T0 + 180_000 },
      { id: 'b', startedAt: T0 + 86_400_000, endedAt: T0 + 86_580_000 },
    ]);
  });
});

describe('SqliteActivityRepository: rename, time zone, restore', () => {
  const outbox = (db: ReturnType<typeof openNodeDatabase>) =>
    db.all<{ type: string; payload: string }>('SELECT type, payload FROM sys_outbox ORDER BY id');

  it('saves a rename and its ActivityRenamed event together, with when it happened', async () => {
    const { db, repo } = await setup();
    await repo.save(record(null), points);
    const a = (await repo.get('a'))!;
    a.rename('  Lunch walk ', T0 + 1_000);
    await repo.save(a);
    expect((await repo.get('a'))!.toState()).toMatchObject({ name: 'Lunch walk', renamedAt: T0 + 1_000 });
    const events = await outbox(db);
    expect(events.map((e) => e.type)).toEqual(['ActivityRecorded', 'ActivityRenamed']);
    expect(JSON.parse(events[1].payload)).toEqual({
      type: 'ActivityRenamed',
      v: 1,
      at: T0 + 1_000,
      activityId: 'a',
      name: 'Lunch walk',
      renamedAt: T0 + 1_000,
    });
  });

  it('keeps the time zone the Activity was saved in; the repair fills only missing ones', async () => {
    const { repo } = await setup();
    await repo.save(
      Activity.record({
        id: 'z',
        type: 'walk',
        startedAt: T0,
        endedAt: T0 + 180_000,
        track: trackFromPoints(points),
        now: T0,
        timeZone: 'Europe/Warsaw',
      }),
      points
    );
    await repo.save(record(null), points);
    expect((await repo.get('z'))!.toState().timeZone).toBe('Europe/Warsaw');
    expect(await repo.idsWithoutTimeZone()).toEqual(['a']);
    const a = (await repo.get('a'))!;
    expect(a.assignTimeZone('Asia/Tokyo')).toBe(true);
    await repo.save(a);
    expect(await repo.idsWithoutTimeZone()).toEqual([]);
    const z = (await repo.get('z'))!;
    expect(z.assignTimeZone('Asia/Tokyo')).toBe(false);
  });

  it('saves a restored Activity with its gap routes and check time in one transaction', async () => {
    const { db, repo } = await setup();
    const restored = Activity.restore({
      id: 'r',
      type: 'walk',
      name: 'Old town loop',
      startedAt: T0,
      endedAt: T0 + 180_000,
      track: trackFromPoints(points),
      resumedSegments: null,
      timeZone: 'Europe/Warsaw',
      renamedAt: T0 - 5,
      now: T0 + 9,
    });
    const route = {
      afterSegment: 0,
      distanceM: 120,
      movingS: 80,
      coords: [
        [21, 52.2],
        [21, 52.201],
      ] as [number, number][],
    };
    await repo.save(restored, points, { routes: [route], checkedAt: T0 + 7 });
    expect(await repo.gapsCheckedAt('r')).toBe(T0 + 7);
    expect(await repo.gapRoutesOf('r')).toEqual([route]);
    expect(await repo.idsWithUncheckedGaps()).toEqual([]);
    expect((await repo.list(5))[0]).toMatchObject({ id: 'r', name: 'Old town loop', estimatedDistanceM: 120 });
    const events = await outbox(db);
    expect(events.map((e) => e.type)).toEqual(['ActivityRecorded']);
    expect(JSON.parse(events[0].payload)).toMatchObject({ origin: 'restore', activityId: 'r' });

    // A failing insert rolls everything back: no half-restored Activity.
    const broken = Activity.restore({ ...restored.toState(), id: 'r2', track: trackFromPoints(points), now: T0 });
    await expect(
      repo.save(broken, points, { routes: [route, route], checkedAt: T0 + 7 }) // duplicate primary key
    ).rejects.toThrow();
    expect(await repo.exists('r2')).toBe(false);
  });
});
