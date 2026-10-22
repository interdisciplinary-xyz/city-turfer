/**
 * The backup's application model: what the server stores per user and hands to the routes. Times
 * are epoch ms here; the routes format them as ISO 8601 UTC.
 */

/** A track point as uploaded: `[lon, lat, t (epoch ms), segment, altitudeM | null]`. */
export type CompactPoint = [number, number, number, number, number | null];

export type ActivityTypeName = 'walk' | 'run' | 'cycle';
export type ActivitySourceName = 'recording' | 'apple-health' | 'import';
export type ConsentPurposeName = 'cloud-sync' | 'apple-health-in-cloud-sync';

/** Numbers @cityturfer/core derived from the recorded track (gap routes excluded). */
export interface StoredSummary {
  distanceM: number;
  movingS: number;
  elapsedS: number;
  elevationGainM: number | null;
  splits: { km: number; movingS: number }[];
  bbox: [number, number, number, number] | null;
  preview: [number, number][];
  pointCount: number;
  coreVersion: string;
}

export interface StoredGapRoute {
  afterSegment: number;
  distanceM: number;
  movingS: number;
  coords: [number, number][];
}

export interface ActivityRecord {
  id: string;
  type: ActivityTypeName;
  name: string;
  /** When a `PATCH` last renamed it (phone time); null when never renamed. Last write wins. */
  renamedAt: number | null;
  source: ActivitySourceName;
  startedAt: number;
  endedAt: number;
  timeZone: string | null;
  resumedSegments: number[] | null;
  trackHash: string;
  contentHash: string;
  summary: StoredSummary;
  estimatedDistanceM: number;
  estimatedMovingS: number;
  version: number;
  updatedAt: number;
  changeSeq: number;
}

export interface GapRoutesRecord {
  checkedAt: number;
  routes: StoredGapRoute[];
}

export interface TombstoneRecord {
  activityId: string;
  deletedAt: number;
  changeSeq: number;
}

export interface HomeCityRecord {
  cityId: string | null;
  chosenAt: number;
  recordedAt: number;
  changeSeq: number;
}

export interface ConsentRecord {
  purpose: ConsentPurposeName;
  granted: boolean;
  policyVersion: string;
  at: number;
}

export interface UserRecord {
  id: string;
  email: string | null;
  displayName: string | null;
}

/** One entry of the changes feed, in server order (`seq`). */
export type ChangeRecord =
  | { kind: 'activity'; seq: number; activity: ActivityRecord }
  | { kind: 'tombstone'; seq: number; tombstone: TombstoneRecord }
  | { kind: 'home-city'; seq: number; homeCity: HomeCityRecord };
