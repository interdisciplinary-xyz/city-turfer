import {
  activityTypeFor,
  importedActivityId,
  isImportedFromHealth,
  isSameOuting,
  MAX_ROUTE_ACCURACY_M,
  routeFromTrack,
  trackPointsFromRoute,
  workoutKindFor,
} from '../domain/health-workout';
import { straightRoute } from '../test-support/fake-health-store';

const T0 = Date.parse('2026-10-01T07:00:00Z');

describe('Health workout mapping', () => {
  it('maps Apple Health workout kinds to Activity Types and back', () => {
    expect(activityTypeFor('walking')).toBe('walk');
    expect(activityTypeFor('hiking')).toBe('walk');
    expect(activityTypeFor('running')).toBe('run');
    expect(activityTypeFor('cycling')).toBe('cycle');
    expect(activityTypeFor('other')).toBeNull();
    expect(workoutKindFor('walk')).toBe('walking');
    expect(workoutKindFor('run')).toBe('running');
    expect(workoutKindFor('cycle')).toBe('cycling');
  });

  it('gives imported workouts a stable id', () => {
    expect(importedActivityId('ABC-123')).toBe('hk-ABC-123');
    expect(isImportedFromHealth('hk-ABC-123')).toBe(true);
    expect(isImportedFromHealth('session-uuid')).toBe(false);
  });
});

describe('isSameOuting', () => {
  const hour = 3_600_000;
  it('treats mostly overlapping recordings as one outing', () => {
    expect(isSameOuting({ startedAt: 0, endedAt: hour }, { startedAt: 60_000, endedAt: hour + 60_000 })).toBe(true);
    // A short recording inside a long one (e.g. the phone app stopped early)
    expect(isSameOuting({ startedAt: 0, endedAt: 2 * hour }, { startedAt: hour, endedAt: hour + 600_000 })).toBe(true);
  });
  it('keeps back-to-back or barely overlapping outings apart', () => {
    expect(isSameOuting({ startedAt: 0, endedAt: hour }, { startedAt: hour, endedAt: 2 * hour })).toBe(false);
    expect(isSameOuting({ startedAt: 0, endedAt: hour }, { startedAt: 0.8 * hour, endedAt: 2 * hour })).toBe(false);
  });
});

describe('trackPointsFromRoute', () => {
  it('sorts, drops bad and inaccurate points and duplicate timestamps', () => {
    const route = straightRoute({ lat: 52.25, lon: 21.01, t: T0 }, 1);
    const messy = [
      route[3],
      route[0],
      { ...route[1], accuracy: MAX_ROUTE_ACCURACY_M + 1 },
      route[2],
      { ...route[2], lat: route[2].lat + 0.001 }, // same timestamp
      { ...route[4], lat: Number.NaN },
      { ...route[5], lat: 0, lon: 0 },
      { ...route[6], speed: -1, alt: null },
    ];
    const points = trackPointsFromRoute(messy);
    expect(points.map((p) => p.t)).toEqual([route[0].t, route[2].t, route[3].t, route[6].t]);
    expect(points[3].speed).toBeNull();
    expect(points[3].alt).toBeNull();
    expect(points.every((p) => p.segment === 0)).toBe(true);
  });

  it('starts a new Segment after a pause in the route', () => {
    const first = straightRoute({ lat: 52.25, lon: 21.01, t: T0 }, 2);
    const second = straightRoute({ lat: 52.26, lon: 21.02, t: T0 + 10 * 60_000 }, 2);
    const points = trackPointsFromRoute([...first, ...second]);
    expect(new Set(points.map((p) => p.segment))).toEqual(new Set([0, 1]));
  });

  it('returns no points for a workout without a route', () => {
    expect(trackPointsFromRoute([])).toEqual([]);
  });

  it('turns a track back into a time-ordered route', () => {
    const points = trackPointsFromRoute(straightRoute({ lat: 52.25, lon: 21.01, t: T0 }, 1));
    const route = routeFromTrack([...points].reverse());
    expect(route.map((p) => p.t)).toEqual(points.map((p) => p.t));
  });
});
