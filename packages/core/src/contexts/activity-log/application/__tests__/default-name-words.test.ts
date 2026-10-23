import type { TrackPoint } from '../../../../shared-kernel';
import type { DefaultNameWords } from '../../domain/activity';
import { InMemoryActivityRepository } from '../../test-support/in-memory-activity-repository';
import { type ActivityLogDeps, ImportActivity, RecordActivityFromSession } from '../use-cases';

/** 07:00 local time: a morning Activity wherever the tests run. */
const T0 = new Date(2026, 0, 1, 7, 0).getTime();

const line = (n: number): TrackPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    lat: 52.2 + i * 0.0005,
    lon: 21,
    t: T0 + i * 10_000,
    segment: 0,
    alt: null,
    accuracy: null,
    speed: null,
  }));

function deps(defaultNameWords?: ActivityLogDeps['defaultNameWords']) {
  const activities = new InMemoryActivityRepository();
  const d: ActivityLogDeps = {
    activities,
    finishedTracks: { trackOf: async () => line(6) },
    router: { route: async () => null },
    gapRouting: {
      setting: { isEnabled: async () => false, setEnabled: async () => undefined },
      isForeground: () => false,
      wait: async () => undefined,
    },
    clock: { now: () => T0 + 3_600_000 },
    afterCommit: () => undefined,
    defaultNameWords,
  };
  return { activities, d };
}

const nameOf = async (activities: InMemoryActivityRepository, id: string) => (await activities.get(id))?.toState().name;

const polish: DefaultNameWords = (part, type) =>
  `${{ morning: 'Poranny', afternoon: 'Popołudniowy', evening: 'Wieczorny', night: 'Nocny' }[part]} ${
    { walk: 'spacer', run: 'bieg', cycle: 'rower' }[type]
  }`;

const finished = { sessionId: 's1', activityType: 'run' as const, startedAt: T0, endedAt: T0 + 60_000 };

describe('default Activity names', () => {
  it('are English without words (the API and older callers)', async () => {
    const { activities, d } = deps();
    await new RecordActivityFromSession(d).execute(finished);
    await new ImportActivity(d).execute({ id: 'imp', type: 'cycle', points: line(4) });
    expect(await nameOf(activities, 's1')).toBe('Morning run');
    expect(await nameOf(activities, 'imp')).toBe('Morning ride');
  });

  it('use the words given at creation, for recordings and imports', async () => {
    const { activities, d } = deps(async () => polish);
    await new RecordActivityFromSession(d).execute(finished);
    await new ImportActivity(d).execute({ id: 'imp', type: 'walk', points: line(4) });
    expect(await nameOf(activities, 's1')).toBe('Poranny bieg');
    expect(await nameOf(activities, 'imp')).toBe('Poranny spacer');
  });

  it('fall back to English when the words cannot be had', async () => {
    const { activities, d } = deps(async () => {
      throw new Error('keychain locked');
    });
    await new RecordActivityFromSession(d).execute(finished);
    expect(await nameOf(activities, 's1')).toBe('Morning run');
  });

  it('are asked for only when an Activity is created', async () => {
    let asked = 0;
    const { d } = deps(() => {
      asked++;
      return polish;
    });
    await new RecordActivityFromSession(d).execute(finished);
    await new RecordActivityFromSession(d).execute(finished); // exists: nothing created
    expect(asked).toBe(1);
  });
});
