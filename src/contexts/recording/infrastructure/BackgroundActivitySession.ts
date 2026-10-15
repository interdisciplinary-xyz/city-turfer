import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * iOS 17+ CLBackgroundActivitySession (local module `modules/background-session`).
 * While held, iOS keeps the app's location session alive with the screen locked
 * and shows the blue location indicator. Optional: a no-op on Android and on
 * builds without the native module (OTA updates to older binaries).
 */
interface BackgroundSessionNative {
  start(): Promise<boolean>;
  stop(): Promise<void>;
  isActive(): boolean;
  isLowPowerMode(): boolean;
}

const native = requireOptionalNativeModule<BackgroundSessionNative>('BackgroundSession');

export const backgroundActivitySession = {
  available: native != null,
  start: async (): Promise<boolean> => (native ? native.start().catch(() => false) : false),
  stop: async (): Promise<void> => void (await native?.stop().catch(() => undefined)),
  /** Re-acquire after a relaunch (the session lives in native memory only). */
  ensure: async (): Promise<boolean> => (native ? native.isActive() || native.start().catch(() => false) : false),
  isActive: (): boolean | null => (native ? native.isActive() : null),
  isLowPowerMode: (): boolean | null => (native ? native.isLowPowerMode() : null),
};
