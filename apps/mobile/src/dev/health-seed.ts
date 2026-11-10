/**
 * Dev only: writes sample workouts with routes into Apple Health (iOS Simulator has no Apple Watch),
 * as if another app had recorded them, so "Import from Apple Health" has something to bring in. They
 * end just now: the import leaves out workouts that ended before Apple Health was connected.
 */
import { Platform } from 'react-native';

import type { ActivityType, GeoPoint } from '@/shared-kernel';

import { generateTrack } from './demo-history';

/** HKWorkoutActivityType raw values. */
const WORKOUT_TYPE: Record<ActivityType, number> = { walk: 52, run: 37, cycle: 13 };
const SAMPLES: { type: ActivityType; km: number }[] = [
  { type: 'walk', km: 3.2 },
  { type: 'run', km: 6.5 },
  { type: 'cycle', km: 14 },
];

export async function seedHealthWorkouts(home: GeoPoint): Promise<number> {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Health exists only on iOS');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const hk = require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');
  await hk.requestAuthorization({
    toRead: ['HKWorkoutTypeIdentifier', 'HKWorkoutRouteTypeIdentifier'],
    toShare: ['HKWorkoutTypeIdentifier', 'HKWorkoutRouteTypeIdentifier'],
  });
  let n = 0;
  for (const [i, s] of SAMPLES.entries()) {
    // Generated from time 0, then moved so it ends a second ago (each type on its own, so they may
    // overlap in time; the import's duplicate check compares workouts of one type only).
    const raw = generateTrack(s.type, s.km, home, 9000 + i, 9100 + i, 0);
    const shift = Date.now() - 1000 - raw[raw.length - 1].t;
    const track = raw.map((p) => ({ ...p, t: p.t + shift }));
    const start = new Date(track[0].t);
    const end = new Date(track[track.length - 1].t);
    const workout = await hk.saveWorkoutSample(
      WORKOUT_TYPE[s.type],
      [],
      start,
      end,
      { distance: s.km * 1000 },
      {
        CityTurferSeed: true,
      }
    );
    await workout.saveWorkoutRoute(
      track.map((p) => ({
        latitude: p.lat,
        longitude: p.lon,
        date: new Date(p.t),
        altitude: p.alt ?? 0,
        verticalAccuracy: 5,
        horizontalAccuracy: p.accuracy ?? 6,
        speed: -1,
        course: -1,
      }))
    );
    n++;
  }
  return n;
}
