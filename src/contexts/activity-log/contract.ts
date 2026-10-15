// Published language of the Activity Log context (types only).
import type { ActivityType, DomainEvent, TrackPoint } from '@/shared-kernel';

export interface ActivityRecorded extends DomainEvent<'ActivityRecorded'> {
  activityId: string;
  activityType: ActivityType;
  startedAt: number;
  endedAt: number;
}
export interface ActivityDeleted extends DomainEvent<'ActivityDeleted'> {
  activityId: string;
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
  distanceM: number;
  movingS: number;
  preview: [number, number][]; // [lon, lat], simplified
}

export interface ActivityDetail extends ActivityListItem {
  endedAt: number;
  elapsedS: number;
  elevGainM: number | null;
  splits: { km: number; seconds: number }[];
  bbox: [number, number, number, number] | null;
  track: TrackPoint[];
}
