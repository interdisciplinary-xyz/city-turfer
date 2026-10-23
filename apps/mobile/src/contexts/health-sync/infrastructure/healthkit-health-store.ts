/**
 * HealthStore on iOS: Apple Health through @kingstinct/react-native-healthkit (HealthKit).
 * Everything Apple-specific (workout types, identifiers, proxies, units) stays in this file.
 */
import type { WorkoutProxyTyped as WorkoutProxy } from '@kingstinct/react-native-healthkit';
import { Platform } from 'react-native';

import { DomainError } from '@/shared-kernel';

import type { HealthStore } from '../application/ports';
import type { HealthRoutePoint, HealthWorkout, HealthWorkoutKind, HealthWorkoutToSave } from '../domain/health-workout';

type HealthKit = typeof import('@kingstinct/react-native-healthkit');

/** Metadata key on every workout CityTurfer saves: lets the import recognise (and skip) our own. */
export const CITYTURFER_ACTIVITY_KEY = 'CityTurferActivityId';

/** HKWorkoutActivityType raw values (stable Apple constants). */
const WORKOUT_TYPE: Record<HealthWorkoutKind, number> = { cycling: 13, hiking: 24, running: 37, walking: 52 };
const KIND_OF_TYPE = new Map<number, HealthWorkoutKind>(
  Object.entries(WORKOUT_TYPE).map(([k, v]) => [v, k as HealthWorkoutKind])
);

const WORKOUT = 'HKWorkoutTypeIdentifier';
const ROUTE = 'HKWorkoutRouteTypeIdentifier';
const DISTANCE_ON_FOOT = 'HKQuantityTypeIdentifierDistanceWalkingRunning';
const DISTANCE_CYCLING = 'HKQuantityTypeIdentifierDistanceCycling';

/** Loads the native module only on iOS, and survives a binary that doesn't have it. */
function loadHealthKit(): HealthKit | null {
  if (Platform.OS !== 'ios') {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const hk = require('@kingstinct/react-native-healthkit') as HealthKit;
    return hk.isHealthDataAvailable() ? hk : null;
  } catch {
    return null;
  }
}

const meters = (q: { quantity: number; unit: string } | undefined): number | null => {
  if (!q) {
    return null;
  }
  const factor: Record<string, number> = { m: 1, meters: 1, km: 1000, mi: 1609.344, ft: 0.3048, yd: 0.9144 };
  return factor[q.unit] != null ? q.quantity * factor[q.unit] : null;
};

export class HealthKitHealthStore implements HealthStore {
  private readonly hk: HealthKit | null;
  /** Proxies from the last page, so reading a route doesn't need another query. */
  private readonly recent = new Map<string, WorkoutProxy>();

  constructor() {
    this.hk = loadHealthKit();
  }

  get available(): boolean {
    return this.hk != null;
  }

  private kit(): HealthKit {
    if (!this.hk) {
      throw new DomainError('health.unavailable');
    }
    return this.hk;
  }

  async requestAccess(): Promise<void> {
    await this.kit().requestAuthorization({
      toRead: [WORKOUT, ROUTE],
      toShare: [WORKOUT, ROUTE, DISTANCE_ON_FOOT, DISTANCE_CYCLING],
    });
  }

  async workoutsSince(anchor: string | null, limit: number): Promise<{ workouts: HealthWorkout[]; anchor: string }> {
    const res = await this.kit().queryWorkoutSamplesWithAnchor({
      limit,
      anchor: anchor ?? undefined,
      filter: { OR: Object.values(WORKOUT_TYPE).map((t) => ({ workoutActivityType: t })) },
    });
    this.recent.clear();
    const workouts = res.workouts.map((w) => {
      this.recent.set(w.uuid, w);
      // Our own exports carry our metadata key. (Not the bundle id: dev tools write sample workouts
      // from this app too, and those must import.)
      const ours = (w.metadata as Record<string, unknown> | undefined)?.[CITYTURFER_ACTIVITY_KEY] != null;
      return {
        uuid: w.uuid,
        kind: KIND_OF_TYPE.get(Number(w.workoutActivityType)) ?? 'other',
        startedAt: new Date(w.startDate).getTime(),
        endedAt: new Date(w.endDate).getTime(),
        distanceM: meters(w.totalDistance),
        fromCityTurfer: ours,
      } satisfies HealthWorkout;
    });
    return { workouts, anchor: res.newAnchor };
  }

  async routeOf(healthUuid: string): Promise<HealthRoutePoint[]> {
    let w = this.recent.get(healthUuid);
    if (!w) {
      const found = await this.kit().queryWorkoutSamples({ limit: 1, filter: { uuid: healthUuid } });
      w = found[0];
    }
    if (!w) {
      return [];
    }
    const routes = await w.getWorkoutRoutes();
    return routes.flatMap((r) =>
      r.locations.map((l) => ({
        lat: l.latitude,
        lon: l.longitude,
        t: new Date(l.date).getTime(),
        alt: l.verticalAccuracy >= 0 ? l.altitude : null,
        accuracy: l.horizontalAccuracy >= 0 ? l.horizontalAccuracy : null,
        speed: l.speed >= 0 ? l.speed : null,
      }))
    );
  }

  async findSavedWorkout(activityId: string): Promise<string | null> {
    const hk = this.kit();
    const found = await hk.queryWorkoutSamples({
      limit: 1,
      filter: {
        metadata: {
          withMetadataKey: CITYTURFER_ACTIVITY_KEY,
          operatorType: hk.ComparisonPredicateOperator.equalTo,
          value: activityId,
        },
      },
    });
    return found[0]?.uuid ?? null;
  }

  async saveWorkout(w: HealthWorkoutToSave): Promise<{ healthUuid: string; routeSaved: boolean }> {
    const hk = this.kit();
    const start = new Date(w.startedAt);
    const end = new Date(w.endedAt);
    const distance = w.distanceM > 0 ? w.distanceM : 0;
    const saved = await hk.saveWorkoutSample(
      WORKOUT_TYPE[w.kind],
      distance > 0
        ? [
            {
              quantityType: w.kind === 'cycling' ? DISTANCE_CYCLING : DISTANCE_ON_FOOT,
              quantity: distance,
              unit: 'm',
              startDate: start,
              endDate: end,
            },
          ]
        : [],
      start,
      end,
      distance > 0 ? { distance } : undefined,
      { [CITYTURFER_ACTIVITY_KEY]: w.activityId }
    );
    let routeSaved = false;
    if (w.route.length >= 2) {
      routeSaved = await saved
        .saveWorkoutRoute(
          w.route.map((p) => ({
            latitude: p.lat,
            longitude: p.lon,
            date: new Date(p.t),
            altitude: p.alt ?? 0,
            verticalAccuracy: p.alt != null ? 10 : -1,
            horizontalAccuracy: p.accuracy ?? 10,
            speed: p.speed ?? -1,
            course: -1,
          }))
        )
        .catch(() => false);
    }
    return { healthUuid: saved.uuid, routeSaved };
  }
}
