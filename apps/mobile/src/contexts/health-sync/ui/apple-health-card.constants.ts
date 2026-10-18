import type { ImportReport } from '../contract';

export const APPLE_HEALTH_TITLE = 'Apple Health';

export const APPLE_HEALTH_PITCH =
  'Bring in your walks, runs, hikes and rides from Apple Health, Apple Watch workouts included, so their streets become your turf too. Activities you record here are saved to Health.';

export const HISTORY_TIP =
  'When Apple asks how much data to share, choose "All Recorded Data" to bring in your whole history, not just the last 30 days.';

export const APPLE_HEALTH_PRIVACY =
  'Health data stays on this phone. To stop CityTurfer reading or writing it, open the Health app › Sharing › Apps › CityTurfer.';

export const NO_WORKOUTS_HINT =
  'Nothing found? In the Health app › Sharing › Apps › CityTurfer, allow Workouts and Workout Routes, with all recorded data.';

export const ERROR_TITLE = 'Apple Health';

/** "12 added · 3 without a route" — the last import, in words. */
export function describeImport(r: ImportReport): string {
  const parts = [`${r.imported} ${r.imported === 1 ? 'workout' : 'workouts'} added`];
  if (r.withoutRoute > 0) {
    parts.push(`${r.withoutRoute} without a route`);
  }
  return parts.join(' · ');
}
