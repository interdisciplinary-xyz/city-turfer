import type { TrackPoint } from '../../../../shared-kernel';
import { InMemoryActivityRepository } from '../../test-support/in-memory-activity-repository';
import { ActivityArchiveQuery, type ActivityLogDeps, ImportActivity, RecordActivityFromSession } from '../use-cases';

const T0 = Date.parse('2026-01-01T07:00:00Z');

const line = (start: number, n: number, segmentAt = Infinity): TrackPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    lat: 52.2 + i * 0.0005,
    lon: 21,
    t: start + i * 10_000,
    segment: i >= segmentAt ? 1 : 0,
    alt: i === 0 ? null : 100 + i,
    accuracy: 5,
    speed: 3,
  }));

function setup() {
  const activities = new InMemoryActivityRepository();
  const deps: ActivityLogDeps = {
    activities,
    finishedTracks: { trackOf: async (id) => (id === 'rec' ? line(T0 + 3_600_000, 6, 3) : null) },
    router: { route: async () => null },
    gapRouting: {
      setting: { isEnabled: async () => false, setEnabled: async () => undefined },
      isForeground: () => false,
      wait: async () => undefined,
    },
    clock: { now: () => T0 + 86_400_000 },
    afterCommit: () => undefined,
  };
  return { activities, deps, archive: new ActivityArchiveQuery(deps) };
}

describe('ActivityArchiveQuery', () => {
  it('lists every activity oldest first', async () => {
    const t = setup();
    await new ImportActivity(t.deps).execute({ id: 'later', type: 'walk', points: line(T0 + 7_200_000, 3) });
    await new ImportActivity(t.deps).execute({ id: 'earlier', type: 'walk', points: line(T0, 3) });
    expect(await t.archive.ids()).toEqual(['earlier', 'later']);
  });

  it('copies name, times, resumed segments, the whole track and the gap routes', async () => {
    const t = setup();
    await new RecordActivityFromSession(t.deps).execute({
      sessionId: 'rec',
      activityType: 'run',
      startedAt: T0 + 3_600_000,
      endedAt: T0 + 3_660_000,
      resumedSegments: [1],
    });
    const coords: [number, number][] = [
      [21, 52.2],
      [21, 52.201],
    ];
    const route = { afterSegment: 0, distanceM: 120, movingS: 40, coords };
    await t.activities.saveGapRoutes('rec', [route], T0 + 90_000_000);

    const a = await t.archive.of('rec');
    expect(a).toMatchObject({
      id: 'rec',
      type: 'run',
      name: 'Morning run',
      startedAt: T0 + 3_600_000,
      endedAt: T0 + 3_660_000,
      resumedSegments: [1],
      gapsCheckedAt: T0 + 90_000_000,
      gapRoutes: [route],
    });
    expect(a!.track).toHaveLength(6);
    expect(a!.track[3]).toMatchObject({ segment: 1, alt: 103 });
  });

  it('answers null for an unknown id; an unchecked import has no gap time and unknown resumes', async () => {
    const t = setup();
    expect(await t.archive.of('nope')).toBeNull();
    await new ImportActivity(t.deps).execute({ id: 'hk-1', type: 'walk', points: line(T0, 3) });
    expect(await t.archive.of('hk-1')).toMatchObject({ resumedSegments: null, gapsCheckedAt: null, gapRoutes: [] });
  });
});
