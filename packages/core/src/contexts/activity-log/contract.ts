// Published language of the Activity Log context (types only).
import type { ActivityType, DomainEvent, TrackPoint } from '../../shared-kernel';

/**
 * Where an Activity came from: a finished Recording Session, imported (demo history, Apple Health),
 * or restored from the user's cloud backup (never exported to Apple Health or uploaded again).
 */
export type ActivityOrigin = 'recording' | 'import' | 'restore';

export interface ActivityRecorded extends DomainEvent<'ActivityRecorded'> {
  activityId: string;
  activityType: ActivityType;
  startedAt: number;
  endedAt: number;
  /** Absent on events written before v0.4.0: those were recordings or demo imports. */
  origin?: ActivityOrigin;
}
export interface ActivityDeleted extends DomainEvent<'ActivityDeleted'> {
  activityId: string;
}
/** The Turfer renamed an Activity (saved in the same transaction as the new name). */
export interface ActivityRenamed extends DomainEvent<'ActivityRenamed'> {
  activityId: string;
  name: string;
  /** Epoch ms; the cloud copy keeps the latest rename (last write wins). */
  renamedAt: number;
}
/** The stored track was corrected (e.g. split at recording gaps); consumers derived from it must rebuild. */
export interface ActivityTrackCorrected extends DomainEvent<'ActivityTrackCorrected'> {
  activityId: string;
  activityType: ActivityType;
  startedAt: number;
}

export interface ActivityListItem {
  id: string;
  type: ActivityType;
  name: string;
  startedAt: number;
  distanceM: number; // recorded + estimated
  movingS: number; // recorded + estimated
  estimatedDistanceM: number; // part of distanceM routed along streets across recording gaps
  preview: [number, number][]; // [lon, lat], simplified
}

export interface ActivityDetail extends ActivityListItem {
  endedAt: number;
  elapsedS: number;
  elevGainM: number | null;
  splits: { km: number; seconds: number }[];
  bbox: [number, number, number, number] | null;
  track: TrackPoint[];
  gapRoutes: { afterSegment: number; coords: [number, number][] }[];
}
/** Gap routes were estimated: distance totals changed (UI refresh only). */
export interface ActivityDistanceEstimated extends DomainEvent<'ActivityDistanceEstimated'> {
  activityId: string;
  estimatedDistanceM: number;
}

/**
 * A complete, portable copy of one Activity: what a backup (or, later, a GPX export) needs to
 * rebuild it elsewhere. Summary numbers are left out: they are derived from the track.
 */
export interface ActivityArchive {
  id: string;
  type: ActivityType;
  name: string;
  startedAt: number;
  endedAt: number;
  /** Segments that began with a manual Resume; null when unknown. */
  resumedSegments: number[] | null;
  track: TrackPoint[];
  /** Street routes estimated across GPS gaps (display and distance only, never turf). */
  gapRoutes: { afterSegment: number; distanceM: number; movingS: number; coords: [number, number][] }[];
  /** When the gap routes were estimated; null when not yet. */
  gapsCheckedAt: number | null;
  /** IANA zone the phone was in when the Activity was saved; null when unknown. */
  timeZone: string | null;
  /** When it was last renamed; null: never. */
  renamedAt: number | null;
}

/** What Restore brings back into Activity Log: a backed-up Activity with its track and gap routes. */
export type RestoredActivity = ActivityArchive;

export type RestoreOutcome = 'restored' | 'exists' | 'invalid';
