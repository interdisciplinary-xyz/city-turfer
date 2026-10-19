import type { HealthStore } from '../application/ports';

/** No Apple Health here (Android, tests that don't need it): Health Sync does nothing. */
export const UNAVAILABLE_HEALTH_STORE: HealthStore = {
  available: false,
  requestAccess: async () => undefined,
  workoutsSince: async (anchor) => ({ workouts: [], anchor: anchor ?? '' }),
  routeOf: async () => [],
  findSavedWorkout: async () => null,
  saveWorkout: async () => {
    throw new Error('Apple Health is not available');
  },
};
