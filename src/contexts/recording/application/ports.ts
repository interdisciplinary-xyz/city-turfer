import type { LiveSnapshot } from '../domain/recording-session';
import type { TrackingProfile } from '../domain/tracking-profile';

export interface LocationTracker {
  start(profile: TrackingProfile): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
  /**
   * Called after every batch ingested into an active session: re-acquire OS
   * resources that live in native memory only (the iOS background activity
   * session after a relaunch). Resolves to whether they are held, or null where
   * the platform has none.
   */
  reacquire(): Promise<boolean | null>;
}

export type PermissionResult = 'granted' | 'denied' | 'services-off';

export interface PermissionGateway {
  /** Foreground ("while using") permission — required to record. */
  ensureForeground(): Promise<PermissionResult>;
  /** Best effort upgrade to background ("always"); recording works without it on iOS + Android FGS. */
  requestBackground(): Promise<boolean>;
}

/** In-memory fan-out of live snapshots to the UI (when the app is foregrounded). */
export interface LiveSessionNotifier {
  publish(snapshot: LiveSnapshot | null): void;
}
