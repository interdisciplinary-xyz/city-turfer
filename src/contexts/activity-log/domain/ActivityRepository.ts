import type { TrackPoint } from '@/shared-kernel';

import type { ActivityListItem } from '../contract';
import type { Activity } from './Activity';
import type { GapRoute } from './GapRoute';

export interface ActivityRepository {
  exists(id: string): Promise<boolean>;
  get(id: string): Promise<Activity | null>;
  /** Atomic: activity + (on first save) its track + pulled events → outbox. */
  save(activity: Activity, track?: readonly TrackPoint[]): Promise<void>;
  /** Atomic: delete activity + its track + ActivityDeleted → outbox. */
  delete(activity: Activity): Promise<void>;
  list(limit: number, beforeStartedAt?: number): Promise<ActivityListItem[]>;
  trackOf(id: string): Promise<TrackPoint[]>;
  /** Atomic: updated totals + replaced track + pulled events → outbox. */
  saveCorrection(activity: Activity, track: readonly TrackPoint[]): Promise<void>;
  allIds(): Promise<string[]>;
  /** Activities whose recording gaps have not been routed yet, oldest first. */
  idsWithUncheckedGaps(): Promise<string[]>;
  typeOf(id: string): Promise<ActivityListItem['type'] | null>;
  /** Atomic: replace gap routes, set estimated totals, mark checked, ActivityDistanceEstimated → outbox. */
  saveGapRoutes(id: string, routes: readonly GapRoute[], now: number): Promise<void>;
  gapRoutesOf(id: string): Promise<GapRoute[]>;
}
