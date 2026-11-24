import type { PlannedRoute } from './planned-route';

/** The one active Planned Route of this profile, on the phone only (never backed up or synced). */
export interface PlannedRouteRepository {
  /** The stored Planned Route, or null when none was ever saved (or it can't be read back). */
  active(): Promise<PlannedRoute | null>;
  /** Replaces the stored Planned Route in one transaction. */
  save(route: PlannedRoute): Promise<void>;
}
