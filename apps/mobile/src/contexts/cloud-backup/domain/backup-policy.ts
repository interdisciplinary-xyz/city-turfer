import { isGdanskPlanActivityId } from '@cityturfer/core/demo';

import { DomainError, type TrackPoint } from '@/shared-kernel';

/**
 * What may leave the phone. Activity ids tell where an Activity came from (published language of
 * Activity Log and Health Sync): `demo-…` is generated demo history, `hk-…` an Apple Health import,
 * anything else a CityTurfer recording.
 */
export type ActivitySourceKind = 'recording' | 'apple-health' | 'demo';

const DEMO_PREFIX = 'demo-';
const APPLE_HEALTH_PREFIX = 'hk-';

/** The server's limit on track points per Activity (contract: Track.points maxItems). */
export const MAX_TRACK_POINTS = 40_000;

export function sourceOf(activityId: string): ActivitySourceKind {
  if (activityId.startsWith(DEMO_PREFIX)) {
    return 'demo';
  }
  return activityId.startsWith(APPLE_HEALTH_PREFIX) ? 'apple-health' : 'recording';
}

/**
 * The track as the server stores and hashes it (contract: TrackPoint `[lon, lat, t, segment,
 * altitudeM | null]`, t in whole ms). `trackHash` is SHA-256 of `JSON.stringify` of exactly this.
 */
export function canonicalTrackPoints(track: readonly TrackPoint[]): [number, number, number, number, number | null][] {
  return track.map((p) => [p.lon, p.lat, Math.round(p.t), p.segment, p.alt ?? null]);
}

/** The text whose SHA-256 is the server's `trackHash`. */
export const trackHashInput = (track: readonly TrackPoint[]): string => JSON.stringify(canonicalTrackPoints(track));

/** What decides whether an Activity may leave the phone, beyond its id. */
export interface UploadScope {
  /** The Turfer turned on "Include Apple Health workouts" (its own consent, decision D2). */
  healthIncluded: boolean;
  /** The signed-in profile is the demo profile: its generated Gdańsk history is its content (LP3). */
  demoProfile: boolean;
}

/**
 * Recordings always; Apple Health imports only with their own consent (decision D2); demo history
 * only from the demo profile, and only the planned Gdańsk history (`demo-gdansk-n<i>`, LP3). Any
 * other `demo-…` Activity never leaves the phone: seeded on another profile, or by the Developer
 * tools seeder (`demo-<ms>`, tracks around the phone's real position) on the demo profile itself.
 */
export function mayUpload(activityId: string, scope: UploadScope): boolean {
  switch (sourceOf(activityId)) {
    case 'recording':
      return true;
    case 'apple-health':
      return scope.healthIncluded;
    case 'demo':
      return scope.demoProfile && isGdanskPlanActivityId(activityId);
  }
}

/** Where an uploaded Activity came from, as the server's `source` names it. */
export type UploadSourceName = 'recording' | 'apple-health' | 'import';

/** The `source` an upload carries: demo history is an import (as the local API seeds it). */
export function uploadSourceOf(activityId: string): UploadSourceName {
  switch (sourceOf(activityId)) {
    case 'apple-health':
      return 'apple-health';
    case 'demo':
      return 'import';
    case 'recording':
      return 'recording';
  }
}

/** Wait before the n-th retry of one Activity: 30 s, doubling, at most 6 h. */
export function retryDelayMs(attempts: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 6 * 3_600_000);
}

/** A pasted device token, trimmed. Tokens have no whitespace inside. */
export function deviceToken(raw: string): string {
  const t = raw.trim();
  if (!t || /\s/.test(t)) {
    throw new DomainError('backup.invalid-token');
  }
  return t;
}

/** A name with the time it was set by a rename (null: never renamed, or not known). */
export interface NameStamp {
  name: string;
  renamedAt: number | null;
}

/**
 * Which name a full upload (PUT) should carry when the server already has the Activity: last write
 * wins on `renamedAt` (decision D6), as the server decides for a PATCH. The server's name wins ties
 * and whenever only the server knows a rename time; the phone's otherwise (the phone stays
 * authoritative for content nobody renamed).
 */
export function nameToUpload(local: NameStamp, server: NameStamp): string {
  if (server.renamedAt != null && (local.renamedAt == null || server.renamedAt >= local.renamedAt)) {
    return server.name;
  }
  return local.name;
}
