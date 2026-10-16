import * as Location from 'expo-location';

import { LOCATION_TASK } from '@/constants/location';

import type { LocationTracker, PermissionGateway, PermissionResult } from '../application/ports';
import type { Fix } from '../domain/fix';
import type { TrackingProfile } from '../domain/tracking-profile';
import { backgroundActivitySession } from './background-activity-session';

/** Anti-corruption layer: the only place that knows expo-location's LocationObject. */
export function toFix(l: Location.LocationObject): Fix {
  const c = l.coords;
  return {
    lat: c.latitude,
    lon: c.longitude,
    t: l.timestamp,
    accuracy: c.accuracy ?? null,
    alt: c.altitude ?? null,
    speed: c.speed != null && c.speed >= 0 ? c.speed : null,
  };
}

const LABEL = { walk: 'walk', run: 'run', cycle: 'ride' } as const;

export class ExpoLocationTracker implements LocationTracker {
  async start(profile: TrackingProfile) {
    if (await this.isRunning()) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: profile.timeIntervalMs,
      distanceInterval: profile.distanceIntervalM,
      activityType: Location.ActivityType.Fitness,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      deferredUpdatesInterval: 0,
      foregroundService: {
        notificationTitle: `Recording your ${LABEL[profile.type]}`,
        notificationBody: 'CityTurfer is claiming your streets. Tap to open.',
        notificationColor: '#F72FA8',
        killServiceOnDestroy: false,
      },
    });
    // Must be acquired while in the foreground (the user just tapped Start).
    await backgroundActivitySession.start();
  }

  async stop() {
    await backgroundActivitySession.stop();
    if (await this.isRunning()) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }

  async isRunning() {
    try {
      return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
    } catch {
      return false;
    }
  }
}

export class ExpoPermissionGateway implements PermissionGateway {
  async ensureForeground(): Promise<PermissionResult> {
    if (!(await Location.hasServicesEnabledAsync())) return 'services-off';
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) return 'granted';
    const asked = await Location.requestForegroundPermissionsAsync();
    return asked.granted ? 'granted' : 'denied';
  }

  async requestBackground(): Promise<boolean> {
    try {
      const current = await Location.getBackgroundPermissionsAsync();
      if (current.granted || !current.canAskAgain) return current.granted;
      // Android uses a foreground service (no background permission needed and
      // the request would bounce the user to Settings). Ask on iOS only.
      if (process.env.EXPO_OS === 'android') return false;
      return (await Location.requestBackgroundPermissionsAsync()).granted;
    } catch {
      return false;
    }
  }
}
