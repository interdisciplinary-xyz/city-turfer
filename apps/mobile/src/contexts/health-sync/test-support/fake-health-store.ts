import type { HealthStore } from '../application/ports';
import type { HealthRoutePoint, HealthWorkout, HealthWorkoutToSave } from '../domain/health-workout';

/** A straight route heading north-east from `start`, one point every `stepS` seconds. */
export function straightRoute(
  start: { lat: number; lon: number; t: number },
  minutes: number,
  speedMps = 1.4,
  stepS = 5
): HealthRoutePoint[] {
  const n = Math.floor((minutes * 60) / stepS);
  const dDeg = (speedMps * stepS) / 111_320;
  return Array.from({ length: n + 1 }, (_, i) => ({
    lat: start.lat + i * dDeg * 0.7,
    lon: start.lon + i * dDeg * 0.7,
    t: start.t + i * stepS * 1000,
    alt: 100,
    accuracy: 5,
    speed: speedMps,
  }));
}

/** In-memory Apple Health: workouts in insertion order; the anchor is the index of the next one. */
export class FakeHealthStore implements HealthStore {
  available = true;
  accessRequests = 0;
  readonly saved: (HealthWorkoutToSave & { healthUuid: string })[] = [];
  failSaves = false;
  private readonly workouts: { w: HealthWorkout; route: HealthRoutePoint[] }[] = [];

  add(w: Partial<HealthWorkout> & { uuid: string }, route: HealthRoutePoint[]): void {
    this.workouts.push({
      w: {
        kind: 'walking',
        startedAt: route[0]?.t ?? 0,
        endedAt: route[route.length - 1]?.t ?? 0,
        distanceM: null,
        fromCityTurfer: false,
        ...w,
      },
      route,
    });
  }

  async requestAccess(): Promise<void> {
    this.accessRequests++;
  }

  async workoutsSince(anchor: string | null, limit: number) {
    const from = anchor ? Number(anchor) : 0;
    const page = this.workouts.slice(from, from + limit);
    return { workouts: page.map((x) => x.w), anchor: String(from + page.length) };
  }

  async routeOf(uuid: string): Promise<HealthRoutePoint[]> {
    return this.workouts.find((x) => x.w.uuid === uuid)?.route ?? [];
  }

  async saveWorkout(w: HealthWorkoutToSave) {
    if (this.failSaves) {
      throw new Error('HealthKit write failed');
    }
    const healthUuid = `saved-${this.saved.length + 1}`;
    this.saved.push({ ...w, healthUuid });
    // What Apple Health would return on the next import: our own workout, marked as ours.
    this.add({ uuid: healthUuid, kind: w.kind, fromCityTurfer: true, startedAt: w.startedAt, endedAt: w.endedAt }, [
      ...w.route,
    ]);
    return { healthUuid, routeSaved: w.route.length >= 2 };
  }

  async findSavedWorkout(activityId: string): Promise<string | null> {
    return this.saved.find((w) => w.activityId === activityId)?.healthUuid ?? null;
  }

  /** A route that shows up later (Apple Watch syncing after the workout). */
  setRoute(uuid: string, route: HealthRoutePoint[]): void {
    const x = this.workouts.find((y) => y.w.uuid === uuid);
    if (x) {
      x.route = route;
    }
  }
}
