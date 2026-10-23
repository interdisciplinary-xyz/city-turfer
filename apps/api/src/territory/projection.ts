import type { Clock, TrackPoint } from '@cityturfer/core/shared-kernel';
import { createTurfApi, type TurfApi } from '@cityturfer/core/territory';
import type { CellGrid } from '@cityturfer/core/territory/ports';

import type { ActivityTypeName, CompactPoint } from '../backup/model';
import { toTrackPoints } from '../backup/summary';
import type { TurfRepository } from './ports';

/** The activity a claim is made from: the Claim's id, type and time. */
export interface ClaimSource {
  id: string;
  type: ActivityTypeName;
  startedAt: number;
}

export interface TurfProjectionDeps {
  /** The user's turf, bound to the same locked transaction as the backup write. */
  repo: TurfRepository;
  grid: CellGrid;
  /** The server's clock. */
  clock: Clock;
  /** The stored track of an activity (catch-up and rebuilds); uploads pass their points instead. */
  storedTrack(activityId: string): Promise<CompactPoint[] | null>;
}

/** The only domain error the projection swallows: a start more than 60 s after the server's now. */
const IN_FUTURE = 'claim.in-future';

const isInFuture = (e: unknown) => (e as { code?: unknown } | null)?.code === IN_FUTURE;

/**
 * The server's turf projection of one user: Territory's own use cases (`createTurfApi` from
 * @cityturfer/core) over the Postgres repository, run inside the backup write's transaction after
 * `lock()`, so an activity and its claim commit together. No rule is re-implemented here: cells,
 * claims and strength come from the core. `afterCommit` is a no-op and the Claim's events are
 * dropped (the server has no outbox).
 *
 * A turf failure fails the upload (the phone retries), except `claim.in-future` (a clock ahead of
 * the server's): the activity is stored unclaimed and a later `claimMissing` claims it.
 */
export class TurfProjection {
  private readonly api: TurfApi;
  /** Points of the upload being written: the claim reads them instead of the stored track. */
  private readonly uploaded = new Map<string, TrackPoint[]>();

  constructor(private readonly d: TurfProjectionDeps) {
    this.api = createTurfApi({
      repo: d.repo,
      grid: d.grid,
      clock: d.clock,
      afterCommit: () => undefined,
      tracks: {
        trackOf: async (id) => this.uploaded.get(id) ?? toTrackPoints((await d.storedTrack(id)) ?? []),
      },
    });
  }

  /** Claims the activity's turf unless it has a claim already. False when deferred (start in the future). */
  claim(a: ClaimSource, points?: readonly CompactPoint[]): Promise<boolean> {
    return this.deferInFuture(a, points, () =>
      this.api.claimFromActivity.execute({ activityId: a.id, activityType: a.type, startedAt: a.startedAt })
    );
  }

  /** Rebuilds the claim from a changed track, type or start. False when the new claim is deferred. */
  reclaim(a: ClaimSource, points?: readonly CompactPoint[]): Promise<boolean> {
    return this.deferInFuture(a, points, () =>
      this.api.reclaim.execute({ activityId: a.id, activityType: a.type, startedAt: a.startedAt })
    );
  }

  /** Releases the activity's claim (no-op without one). Before the activity row is deleted. */
  async release(activityId: string): Promise<void> {
    await this.api.release.execute(activityId);
  }

  /** Recomputes every Turf Cell from the remaining claims. */
  rebuildAll(): Promise<void> {
    return this.d.repo.rebuildAll();
  }

  /**
   * Claims up to `limit` activities that have no claim yet, oldest first (backfill, deferred
   * future starts). Returns how many were claimed and how many are still deferred.
   */
  async claimMissing(limit: number): Promise<{ claimed: number; deferred: number }> {
    let claimed = 0;
    let deferred = 0;
    for (const a of await this.d.repo.unclaimed(limit)) {
      if (await this.claim(a)) {
        claimed++;
      } else {
        deferred++;
      }
    }
    return { claimed, deferred };
  }

  private async deferInFuture(
    a: ClaimSource,
    points: readonly CompactPoint[] | undefined,
    run: () => Promise<void>
  ): Promise<boolean> {
    if (points) {
      this.uploaded.set(a.id, toTrackPoints(points));
    }
    try {
      await run();
      return true;
    } catch (e) {
      if (isInFuture(e)) {
        return false;
      }
      throw e;
    } finally {
      this.uploaded.delete(a.id);
    }
  }
}
