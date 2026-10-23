import type { TerritoryRepository } from '@cityturfer/core/territory/ports';

import type { ActivityTypeName } from '../backup/model';

/** An activity the projection has not claimed yet (backfill, a deferred future start). */
export interface UnclaimedActivity {
  id: string;
  type: ActivityTypeName;
  startedAt: number;
}

/**
 * Port: the server's turf projection of one user, inside that user's locked transaction. Core's
 * `TerritoryRepository` (what the use cases of `createTurfApi` need) plus the set-based repairs only
 * the server runs. Every change raises the user's `turfVersion` (the turf ETag).
 */
export interface TurfRepository extends TerritoryRepository {
  /** The user's turf version: +1 on every change of the projection. */
  version(): Promise<number>;
  /** Recomputes every Turf Cell from the remaining claims (repair, Apple Health withdrawal). */
  rebuildAll(): Promise<void>;
  /** Deletes every claim and Turf Cell of the user (cloud-sync withdrawal). */
  eraseAll(): Promise<void>;
  /** Activities without a claim, oldest first by `(startedAt, id)`. */
  unclaimed(limit: number): Promise<UnclaimedActivity[]>;
}
