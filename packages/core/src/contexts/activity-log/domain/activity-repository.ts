import type { TrackPoint } from '../../../shared-kernel';
import type { ActivityListItem } from '../contract';
import type { Activity } from './activity';
import type { GapRoute } from './gap-route';

export interface ActivityTimeRange {
  id: string;
  startedAt: number;
  endedAt: number;
}

export interface ActivityRepository {
  exists(id: string): Promise<boolean>;
  get(id: string): Promise<Activity | null>;
  /**
   * Atomic: activity + (on first save) its track + pulled events → outbox. A restored Activity also
   * brings its gap routes and when they were checked (`gaps`), in the same transaction.
   */
  save(
    activity: Activity,
    track?: readonly TrackPoint[],
    gaps?: { routes: readonly GapRoute[]; checkedAt: number }
  ): Promise<void>;
  /** Atomic: delete activity + its track + ActivityDeleted → outbox. */
  delete(activity: Activity): Promise<void>;
  list(limit: number, beforeStartedAt?: number): Promise<ActivityListItem[]>;
  trackOf(id: string): Promise<TrackPoint[]>;
  /** Atomic: updated totals + replaced track + pulled events → outbox. */
  saveCorrection(activity: Activity, track: readonly TrackPoint[]): Promise<void>;
  allIds(): Promise<string[]>;
  /** Activities saved before their time zone was kept (data repair). */
  idsWithoutTimeZone(): Promise<string[]>;
  /** Every Activity's id and start, oldest first (ties by id). */
  timeline(): Promise<ActivityTimeRange[]>;
  /** Activities whose recording gaps have not been routed yet, oldest first. */
  idsWithUncheckedGaps(): Promise<string[]>;
  typeOf(id: string): Promise<ActivityListItem['type'] | null>;
  /** Activities of this type whose time range intersects [startedAt, endedAt]. */
  overlapping(type: ActivityListItem['type'], startedAt: number, endedAt: number): Promise<ActivityTimeRange[]>;
  /** Atomic: replace gap routes, set estimated totals, mark checked, ActivityDistanceEstimated → outbox. */
  saveGapRoutes(id: string, routes: readonly GapRoute[], now: number): Promise<void>;
  gapRoutesOf(id: string): Promise<GapRoute[]>;
  /** When the gap routes were last estimated; null when not yet (or reset by a track correction). */
  gapsCheckedAt(id: string): Promise<number | null>;
}
