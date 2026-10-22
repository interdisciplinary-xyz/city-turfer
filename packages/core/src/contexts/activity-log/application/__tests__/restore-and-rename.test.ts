import { DomainError, type TrackPoint } from '../../../../shared-kernel';
import type { ActivityArchive } from '../../contract';
import { activityNameProblem } from '../../domain/activity';
import { InMemoryActivityRepository } from '../../test-support/in-memory-activity-repository';
import {
  ActivityArchiveQuery,
  type ActivityLogDeps,
  AssignMissingTimeZones,
  ImportActivity,
  RecordActivityFromSession,
  RenameActivity,
  RestoreActivity,
} from '../use-cases';

const T0 = Date.parse('2026-01-01T07:00:00Z');
const NOW = T0 + 86_400_000;

const line = (start: number, n: number): TrackPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    lat: 52.2 + i * 0.0005,
    lon: 21,
    t: start + i * 10_000,
    segment: i >= 3 ? 1 : 0,
    alt: i === 0 ? null : 100 + i,
    accuracy: null,
    speed: null,
  }));

function setup(zone: string | null = 'Europe/Warsaw') {
  const activities = new InMemoryActivityRepository();
  const commits = { n: 0 };
  const routed = { n: 0 };
  const tz = { zone };
  const deps: ActivityLogDeps = {
    activities,
    finishedTracks: { trackOf: async () => line(T0, 6) },
    router: {
      route: async () => {
        routed.n++;
        return null;
      },
    },
    gapRouting: {
      setting: { isEnabled: async () => true, setEnabled: async () => undefined },
      isForeground: () => true,
      wait: async () => undefined,
    },
    clock: { now: () => NOW },
    afterCommit: () => void commits.n++,
    timeZone: () => tz.zone,
  };
  return { activities, deps, commits, routed, tz };
}

const archived = (over: Partial<ActivityArchive> = {}): ActivityArchive => ({
  id: 'rec-1',
  type: 'run',
  name: 'Sunday long run',
  startedAt: T0,
  endedAt: T0 + 60_000,
  resumedSegments: [1],
  track: line(T0, 6),
  gapRoutes: [
    {
      afterSegment: 0,
      distanceM: 200,
      movingS: 60,
      coords: [
        [21, 52.2],
        [21, 52.202],
      ],
    },
  ],
  gapsCheckedAt: T0 + 120_000,
  timeZone: 'America/New_York',
  renamedAt: T0 + 90_000,
  ...over,
});

describe('RenameActivity', () => {
  it('saves the new name with an ActivityRenamed event and its time', async () => {
    const t = setup();
    await new RecordActivityFromSession(t.deps).execute({
      sessionId: 'rec',
      activityType: 'run',
      startedAt: T0,
      endedAt: T0 + 60_000,
    });
    t.activities.events.length = 0;
    await new RenameActivity(t.deps).execute('rec', '  Hill repeats ');
    expect(t.activities.events).toEqual([
      { type: 'ActivityRenamed', v: 1, at: NOW, activityId: 'rec', name: 'Hill repeats', renamedAt: NOW },
    ]);
    expect((await t.activities.get('rec'))!.toState()).toMatchObject({ name: 'Hill repeats', renamedAt: NOW });
    expect(t.commits.n).toBe(2);
  });

  it('records nothing for the same name; refuses an empty or too long one', async () => {
    const t = setup();
    await new ImportActivity(t.deps).execute({ id: 'a', type: 'walk', points: line(T0, 3) });
    const name = (await t.activities.get('a'))!.toState().name;
    t.activities.events.length = 0;
    await new RenameActivity(t.deps).execute('a', name);
    expect(t.activities.events).toEqual([]);
    await expect(new RenameActivity(t.deps).execute('a', '   ')).rejects.toThrow(DomainError);
    await expect(new RenameActivity(t.deps).execute('a', 'x'.repeat(81))).rejects.toThrow('activity.invalid-name');
  });

  it('says why a name is refused, by the same rule the rename applies (for the rename form)', async () => {
    expect(activityNameProblem('   ')).toBe('empty');
    expect(activityNameProblem('x'.repeat(81))).toBe('too-long');
    expect(activityNameProblem(` ${'x'.repeat(80)} `)).toBeNull(); // trimmed first
    expect(activityNameProblem('Hill repeats')).toBeNull();
    const t = setup();
    await new ImportActivity(t.deps).execute({ id: 'a', type: 'walk', points: line(T0, 3) });
    await new RenameActivity(t.deps).execute('a', ` ${'y'.repeat(80)} `);
    expect((await t.activities.get('a'))!.toState().name).toBe('y'.repeat(80));
  });
});

describe('time zone of an Activity', () => {
  it('keeps the zone of the phone when the Activity is saved, and never changes it afterwards', async () => {
    const t = setup('Europe/Warsaw');
    await new ImportActivity(t.deps).execute({ id: 'a', type: 'walk', points: line(T0, 3) });
    t.tz.zone = 'Asia/Tokyo'; // travelled
    expect((await new ActivityArchiveQuery(t.deps).of('a'))!.timeZone).toBe('Europe/Warsaw');
    expect(await new AssignMissingTimeZones(t.deps).execute()).toEqual({ checked: 0, assigned: 0 });
  });

  it('repair: Activities saved without a zone get the current one, once', async () => {
    const t = setup(null);
    await new ImportActivity(t.deps).execute({ id: 'a', type: 'walk', points: line(T0, 3) });
    expect((await t.activities.get('a'))!.toState().timeZone).toBeNull();
    expect(await new AssignMissingTimeZones(t.deps).execute()).toEqual({ checked: 0, assigned: 0 }); // zone unknown
    t.tz.zone = 'Europe/Berlin';
    expect(await new AssignMissingTimeZones(t.deps).execute()).toEqual({ checked: 1, assigned: 1 });
    expect((await t.activities.get('a'))!.toState().timeZone).toBe('Europe/Berlin');
  });
});

describe('RestoreActivity', () => {
  it('brings back name, times, resumed segments, zone, rename time, track and checked gap routes', async () => {
    const t = setup('Europe/Warsaw');
    expect(await new RestoreActivity(t.deps).execute(archived())).toBe('restored');
    const copy = await new ActivityArchiveQuery(t.deps).of('rec-1');
    expect(copy).toEqual(archived());
    expect(t.activities.events).toEqual([
      expect.objectContaining({ type: 'ActivityRecorded', activityId: 'rec-1', origin: 'restore', startedAt: T0 }),
    ]);
    expect(await t.activities.idsWithUncheckedGaps()).toEqual([]);
    expect(t.commits.n).toBe(1);
  });

  it('is idempotent by id, and refuses content it cannot hold', async () => {
    const t = setup();
    expect(await new RestoreActivity(t.deps).execute(archived())).toBe('restored');
    expect(await new RestoreActivity(t.deps).execute(archived({ name: 'Other' }))).toBe('exists');
    expect((await t.activities.get('rec-1'))!.toState().name).toBe('Sunday long run');
    expect(await new RestoreActivity(t.deps).execute(archived({ id: 'b', track: line(T0, 1) }))).toBe('invalid');
    expect(await new RestoreActivity(t.deps).execute(archived({ id: 'c', name: ' ' }))).toBe('invalid');
    expect(await t.activities.allIds()).toEqual(['rec-1']);
  });

  it('leaves gaps unchecked when the backup had not checked them (estimated later on this phone)', async () => {
    const t = setup();
    await new RestoreActivity(t.deps).execute(archived({ gapRoutes: [], gapsCheckedAt: null }));
    expect(await t.activities.idsWithUncheckedGaps()).toEqual(['rec-1']);
  });
});
