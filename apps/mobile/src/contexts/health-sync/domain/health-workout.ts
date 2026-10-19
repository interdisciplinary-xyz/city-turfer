/**
 * Health Sync's model of Apple Health data. "Workout" is Apple's word and stays inside this
 * context (anti-corruption layer): everywhere else it is an Activity with a Track.
 */
import { type ActivityType, splitAtGaps, type TrackPoint } from '@/shared-kernel';

/** The Apple Health workout types CityTurfer imports. Anything else is 'other' and skipped. */
export type HealthWorkoutKind = 'walking' | 'hiking' | 'running' | 'cycling';

/** A workout read from Apple Health (no route: that is fetched separately, only when needed). */
export interface HealthWorkout {
  readonly uuid: string;
  readonly kind: HealthWorkoutKind | 'other';
  readonly startedAt: number; // epoch ms
  readonly endedAt: number;
  readonly distanceM: number | null;
  /** Written by CityTurfer itself (our bundle or our metadata key): never imported back. */
  readonly fromCityTurfer: boolean;
}

/** One location of a workout route. SI units; null when Health didn't record it. */
export interface HealthRoutePoint {
  readonly lat: number;
  readonly lon: number;
  readonly t: number; // epoch ms
  readonly alt: number | null;
  readonly accuracy: number | null; // horizontal, metres
  readonly speed: number | null; // m/s
}

/** A workout CityTurfer saves to Apple Health. */
export interface HealthWorkoutToSave {
  readonly activityId: string;
  readonly kind: HealthWorkoutKind;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly distanceM: number;
  readonly route: readonly HealthRoutePoint[];
}

/** Route points less accurate than this are dropped on import (same spirit as the Fix Filter). */
export const MAX_ROUTE_ACCURACY_M = 50;

const ACTIVITY_TYPE_OF: Record<HealthWorkoutKind, ActivityType> = {
  walking: 'walk',
  hiking: 'walk',
  running: 'run',
  cycling: 'cycle',
};

const KIND_OF: Record<ActivityType, HealthWorkoutKind> = { walk: 'walking', run: 'running', cycle: 'cycling' };

/** Activity Type for an Apple Health workout, or null when CityTurfer doesn't import that kind. */
export function activityTypeFor(kind: HealthWorkout['kind']): ActivityType | null {
  return kind === 'other' ? null : ACTIVITY_TYPE_OF[kind];
}

/** Apple Health workout type for a CityTurfer Activity Type. */
export function workoutKindFor(type: ActivityType): HealthWorkoutKind {
  return KIND_OF[type];
}

/** Two recordings of one outing (e.g. Apple Watch and another app) overlap at least this much. */
export const SAME_OUTING_OVERLAP = 0.5;

/**
 * Is `a` the same outing as `b`? Their time ranges overlap by at least half of the shorter one.
 * Used to skip a workout that is already in CityTurfer under another source.
 */
export function isSameOuting(
  a: { startedAt: number; endedAt: number },
  b: { startedAt: number; endedAt: number }
): boolean {
  const overlap = Math.min(a.endedAt, b.endedAt) - Math.max(a.startedAt, b.startedAt);
  const shorter = Math.min(a.endedAt - a.startedAt, b.endedAt - b.startedAt);
  return overlap > 0 && overlap >= SAME_OUTING_OVERLAP * Math.max(shorter, 1);
}

const IMPORTED_PREFIX = 'hk-';

/** Activity id of an imported workout: stable, so importing twice never creates a duplicate. */
export function importedActivityId(healthUuid: string): string {
  return `${IMPORTED_PREFIX}${healthUuid}`;
}

/** Was this Activity imported from Apple Health? */
export function isImportedFromHealth(activityId: string): boolean {
  return activityId.startsWith(IMPORTED_PREFIX);
}

const isValid = (p: HealthRoutePoint) =>
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lon) &&
  Number.isFinite(p.t) &&
  Math.abs(p.lat) <= 90 &&
  Math.abs(p.lon) <= 180 &&
  !(p.lat === 0 && p.lon === 0) &&
  (p.accuracy == null || (p.accuracy >= 0 && p.accuracy <= MAX_ROUTE_ACCURACY_M));

const orNull = (n: number | null) => (n == null || !Number.isFinite(n) || n < 0 ? null : n);

/**
 * Track Points for a workout route: invalid and inaccurate points dropped, time-ordered, one point
 * per timestamp, split into Segments wherever the route has a gap (paused workout, lost signal).
 */
export function trackPointsFromRoute(route: readonly HealthRoutePoint[]): TrackPoint[] {
  const sorted = route.filter(isValid).sort((a, b) => a.t - b.t);
  const points: TrackPoint[] = [];
  for (const p of sorted) {
    if (points.length > 0 && points[points.length - 1].t === p.t) {
      continue;
    }
    points.push({
      lat: p.lat,
      lon: p.lon,
      t: p.t,
      segment: 0,
      alt: p.alt != null && Number.isFinite(p.alt) ? p.alt : null,
      accuracy: orNull(p.accuracy),
      speed: orNull(p.speed),
    });
  }
  return splitAtGaps(points);
}

/** Route to save to Apple Health for a CityTurfer track. */
export function routeFromTrack(track: readonly TrackPoint[]): HealthRoutePoint[] {
  return [...track]
    .sort((a, b) => a.t - b.t)
    .map((p) => ({ lat: p.lat, lon: p.lon, t: p.t, alt: p.alt, accuracy: p.accuracy, speed: p.speed }));
}
