import { NAME } from '@cityturfer/brand';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { LOCATION_TASK } from '@/constants/location';
// The modules, not the @/i18n barrel: that one brings the React provider (not needed here, nor in Jest).
import { loadLanguageSetting } from '@/i18n/language';
import { translator } from '@/i18n/translator';

import type { LocationTracker, PermissionGateway, PermissionResult } from '../application/ports';
import type { Fix } from '../domain/fix';
import type { TrackingProfile } from '../domain/tracking-profile';
import { backgroundActivitySession } from './background-activity-session';

/** Anti-corruption layer: the only place that knows expo-location's LocationObject. */
export function toFix(l: Location.LocationObject): Fix {
  return toFixOn(l, Platform.OS);
}

/**
 * `toFix` for an explicit platform (testable; `toFix` stays unary so `locations.map(toFix)`
 * cannot pass the array index as a platform).
 *
 * Android: expo-location copies `Location.getSpeed()` / `getAltitude()` without checking
 * `hasSpeed()` / `hasAltitude()`, and those getters return 0.0 when the value is unknown. A
 * reported 0 is therefore indistinguishable from "no data"; read as a real 0 m/s it holds
 * auto-pause shut whenever the chip has no Doppler speed. Map both to null: the Fix Filter then
 * uses the speed implied by positions, which is ~0 when really standing still, so a genuine 0
 * loses nothing. The cost is that a true altitude of exactly 0 m is dropped, which elevation
 * maths tolerates (null altitudes are skipped).
 * iOS reports unknown speed as -1 (handled by `>= 0`) and unknown altitude via verticalAccuracy,
 * so a 0 there is a real reading and is kept.
 */
export function toFixOn(l: Location.LocationObject, os: typeof Platform.OS): Fix {
  const c = l.coords;
  const unknownZero = os === 'android';
  const speed = c.speed != null && c.speed >= 0 && !(unknownZero && c.speed === 0) ? c.speed : null;
  const alt = c.altitude != null && !(unknownZero && c.altitude === 0) ? c.altitude : null;
  return {
    lat: c.latitude,
    lon: c.longitude,
    t: l.timestamp,
    accuracy: c.accuracy ?? null,
    alt,
    speed,
  };
}

export class ExpoLocationTracker implements LocationTracker {
  async start(profile: TrackingProfile) {
    if (await this.isRunning()) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
    // The notification text in the app language; a headless launch has not read the setting yet.
    await loadLanguageSetting().catch(() => undefined);
    const t = translator('record');
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: profile.timeIntervalMs,
      distanceInterval: profile.distanceIntervalM,
      activityType: Location.ActivityType.Fitness,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      deferredUpdatesInterval: 0,
      foregroundService: {
        notificationTitle: t('notification.title', { type: profile.type }),
        notificationBody: t('notification.body', { app: NAME }),
        notificationColor: ACCENT,
        killServiceOnDestroy: false,
      },
    });
    // Must be acquired while in the foreground (the user just tapped Start).
    await backgroundActivitySession.start();
  }

  async stop() {
    await backgroundActivitySession.stop();
    if (await this.isRunning()) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  }

  async reacquire() {
    return backgroundActivitySession.available ? backgroundActivitySession.ensure() : null;
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
    if (!(await Location.hasServicesEnabledAsync())) {
      return 'services-off';
    }
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) {
      return 'granted';
    }
    const asked = await Location.requestForegroundPermissionsAsync();
    return asked.granted ? 'granted' : 'denied';
  }

  async requestBackground(): Promise<boolean> {
    try {
      const current = await Location.getBackgroundPermissionsAsync();
      if (current.granted || !current.canAskAgain) {
        return current.granted;
      }
      // Android uses a foreground service (no background permission needed and
      // the request would bounce the user to Settings). Ask on iOS only.
      if (process.env.EXPO_OS === 'android') {
        return false;
      }
      return (await Location.requestBackgroundPermissionsAsync()).granted;
    } catch {
      return false;
    }
  }
}
