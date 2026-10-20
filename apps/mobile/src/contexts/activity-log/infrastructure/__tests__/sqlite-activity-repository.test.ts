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
    a.rename('Lunch walk');
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
