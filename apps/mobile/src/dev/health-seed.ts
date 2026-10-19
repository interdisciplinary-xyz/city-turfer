/**
 * Dev only: writes sample workouts with routes into Apple Health (iOS Simulator has no Apple Watch),
 * as if another app had recorded them, so "Import from Apple Health" has something to bring in.
 */
import { Platform } from 'react-native';

import type { ActivityType, GeoPoint } from '@/shared-kernel';

import { generateTrack } from './demo-history';

/** HKWorkoutActivityType raw values. */
const WORKOUT_TYPE: Record<ActivityType, number> = { walk: 52, run: 37, cycle: 13 };
const SAMPLES: { type: ActivityType; km: number; daysAgo: number; hour: number }[] = [
  { type: 'walk', km: 3.2, daysAgo: 2, hour: 7 },
  { type: 'run', km: 6.5, daysAgo: 5, hour: 18 },
  { type: 'cycle', km: 14, daysAgo: 9, hour: 10 },
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
    const day = new Date();
    day.setDate(day.getDate() - s.daysAgo);
    day.setHours(s.hour, 0, 0, 0);
    const track = generateTrack(s.type, s.km, home, 9000 + i, 9100 + i, day.getTime());
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
