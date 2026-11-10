import type { TrackPoint } from '../../../../shared-kernel';
import { InMemoryActivityRepository } from '../../test-support/in-memory-activity-repository';
import {
  type ActivityLogDeps,
  ActivityStartsQuery,
  DeleteActivity,
  GetActivityDetail,
  ImportActivity,
} from '../use-cases';

const T0 = Date.parse('2026-11-10T07:00:00Z');
const HOUR = 3_600_000;

const line = (start: number, n: number): TrackPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    lat: 52.2 + i * 0.0005,
    lon: 21,
    t: start + i * 10_000,
    segment: 0,
    alt: null,
    accuracy: 5,
    speed: 3,
  }));

function setup() {
  const activities = new InMemoryActivityRepository();
  const deps: ActivityLogDeps = {
    activities,
    finishedTracks: { trackOf: async () => null },
    router: { route: async () => null },
    gapRouting: {
      setting: { isEnabled: async () => false, setEnabled: async () => undefined },
      isForeground: () => false,
      wait: async () => undefined,
    },
    clock: { now: () => T0 + 24 * HOUR },
    afterCommit: () => undefined,
  };
  const add = (id: string, start: number, type: 'walk' | 'run' | 'cycle' = 'walk') =>
    new ImportActivity(deps).execute({ id, type, points: line(start, 6) });
  return { activities, deps, add, starts: new ActivityStartsQuery(deps) };
}

describe('ActivityStartsQuery', () => {
  it('returns activities started in [from, to), oldest first, all types', async () => {
    const t = setup();
    await t.add('before', T0 - 1);
    await t.add('at-from', T0, 'run');
    await t.add('inside', T0 + HOUR, 'cycle');
    await t.add('at-to', T0 + 2 * HOUR);
    const r = await t.starts.execute(T0, T0 + 2 * HOUR);
    expect(r.map((a) => [a.id, a.type, a.startedAt])).toEqual([
      ['at-from', 'run', T0],
      ['inside', 'cycle', T0 + HOUR],
    ]);
  });

  it('counts recorded plus estimated moving time, as the detail does', async () => {
    const t = setup();
    await t.add('gap', T0);
    await t.activities.saveGapRoutes(
      'gap',
      [
        {
          afterSegment: 0,
          distanceM: 100,
          movingS: 70,
          coords: [
            [21, 52.2],
            [21, 52.201],
          ],
        },
      ],
      T0 + HOUR
    );
    const [a] = await t.starts.execute(T0, T0 + HOUR);
    const detail = await new GetActivityDetail(t.deps).execute('gap');
    expect(detail).not.toBeNull();
    expect(a.movingS).toBe(detail!.movingS);
    expect(a.movingS).toBeGreaterThanOrEqual(70);
  });

  it('drops a deleted activity', async () => {
    const t = setup();
    await t.add('gone', T0);
    await new DeleteActivity(t.deps).execute('gone');
    expect(await t.starts.execute(T0, T0 + HOUR)).toEqual([]);
  });

  it('returns nothing for an empty or inverted range', async () => {
    const t = setup();
    await t.add('a', T0);
    expect(await t.starts.execute(T0, T0)).toEqual([]);
    expect(await t.starts.execute(T0 + HOUR, T0)).toEqual([]);
  });
});
