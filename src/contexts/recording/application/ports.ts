import type { LiveSnapshot } from '../domain/RecordingSession';
import type { TrackingProfile } from '../domain/TrackingProfile';

export interface LocationTracker {
  start(profile: TrackingProfile): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
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
