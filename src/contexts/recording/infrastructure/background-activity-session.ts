import type { LocationObject } from 'expo-location';
import { type EventSubscription, requireOptionalNativeModule } from 'expo-modules-core';

/**
 * iOS 17+ workout-style tracking (local module `modules/background-session`):
 * a CLBackgroundActivitySession plus a CLLocationUpdate.liveUpdates stream, so
 * iOS keeps recording with the screen locked. Optional: a no-op on Android and
 * on builds without the native module (OTA updates to older binaries).
 */
interface BackgroundSessionNative {
  start(): Promise<boolean>;
  stop(): Promise<void>;
  isActive(): boolean;
  isStreaming?(): boolean; // added with the live location stream
  isLowPowerMode(): boolean;
  addListener(event: 'onLocations', listener: (e: { locations: LocationObject[] }) => void): EventSubscription;
}

const native = requireOptionalNativeModule<BackgroundSessionNative>('BackgroundSession');

export const backgroundActivitySession = {
  available: native != null,
  start: async (): Promise<boolean> => (native ? native.start().catch(() => false) : false),
  stop: async (): Promise<void> => void (await native?.stop().catch(() => undefined)),
  /** Re-acquire after a relaunch (the session lives in native memory only). */
  ensure: async (): Promise<boolean> =>
    native ? (native.isActive() && (native.isStreaming?.() ?? true)) || native.start().catch(() => false) : false,
  isActive: (): boolean | null => (native ? native.isActive() : null),
  isStreaming: (): boolean | null => (native?.isStreaming ? native.isStreaming() : null),
  isLowPowerMode: (): boolean | null => (native ? native.isLowPowerMode() : null),
  /** Fixes from CLLocationUpdate.liveUpdates; no-op without the native stream. */
  addLocationListener(listener: (locations: LocationObject[]) => void): EventSubscription | null {
    if (!native?.isStreaming) return null; // older binary: module without the stream
    return native.addListener('onLocations', (e) => listener(e.locations ?? []));
  },
};
