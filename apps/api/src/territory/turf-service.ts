import { createHash } from 'node:crypto';

import type { Clock } from '@cityturfer/core/shared-kernel';
import { createTurfApi, type TurfApi } from '@cityturfer/core/territory';
import type { CellGrid } from '@cityturfer/core/territory/ports';

import { AppError } from '../backup/app-error';
import type { BackupStore, UserReader } from '../backup/ports';
import { existingActivity } from '../backup/use-cases';
import { decodeCursor, encodeCursor } from '../cursor';

/**
 * Default and largest page of `GET /v1/turf/cells` (a 50k page is ~1.5 MB of JSON): most users get
 * their whole turf in one page, which no upload can invalidate halfway through a download.
 */
export const TURF_PAGE_DEFAULT = 50_000;
export const TURF_PAGE_MAX = 50_000;

/** `Retry-After` (seconds) of `503 turf.busy`: the turf kept changing under a first page. */
export const TURF_BUSY_RETRY_S = 5;

/** One Turf Cell as the API lists it: `[h3Id, walk, run, cycle]` visit counts. */
export type TurfCellRow = [cell: string, walk: number, run: number, cycle: number];

/**
 * Where a cell download stands: the turf version (`v`) and the account's epoch (`c`: a re-created
 * account restarts its versions at 0) it was paged at, and the offset (`o`). Never a cell id, and
 * nothing decodable about the account: cursors end up in URLs and logs of proxies.
 */
interface CellsPosition {
  v: number;
  c: string;
  o: number;
}

const isCellsPosition = (x: unknown): x is CellsPosition => {
  const p = x as Partial<CellsPosition> | null;
  return (
    !!p &&
    typeof p === 'object' &&
    Number.isSafeInteger(p.v) &&
    typeof p.c === 'string' &&
    p.c.length <= 16 &&
    Number.isSafeInteger(p.o) &&
    (p.o as number) >= 0
  );
};

/** The turf entity tag: `"t<turfVersion>-<account epoch>"`. */
export const turfEtagOf = (version: number, created: string) => `"t${version}-${created}"`;

/** Does an `If-None-Match` header name this entity tag (`*`, weak tags and lists included)? */
export const matchesTag = (header: string | undefined, etag: string) =>
  !!header &&
  header.split(',').some((t) => {
    const tag = t.trim();
    return tag === '*' || tag.replace(/^W\//, '') === etag;
  });

/**
 * An opaque id of this incarnation of the account: changes when an erased account is re-created,
 * reveals neither its id nor when it was created (`created` in a cursor would be both).
 */
const accountEpoch = (userId: string, createdAt: number) =>
  createHash('sha256').update(`${userId}:${createdAt}`).digest('base64url').slice(0, 12);

export type CellsAnswer =
  | { notModified: true; etag: string }
  | {
      notModified: false;
      etag: string;
      turfVersion: number;
      total: number;
      cells: TurfCellRow[];
      nextCursor: string | null;
    };

/** How often a page is read again when the turf changed while it was being read. */
const CONSISTENT_READ_TRIES = 3;

/**
 * The turf reads of the API (`GET /v1/turf/*`): Territory's own query use cases from
 * `createTurfApi` (@cityturfer/core) over the user's stored projection, with the server's clock.
 * Nothing is computed here but paging and entity tags. Reads take no lock: a page is checked
 * against the turf version before and after it is read, so it never mixes two versions.
 */
export class TurfService {
  constructor(
    private readonly store: BackupStore,
    private readonly clock: Clock,
    private readonly grid: CellGrid
  ) {}

  private api(reader: UserReader): TurfApi {
    return createTurfApi({
      repo: reader.turf,
      grid: this.grid,
      clock: this.clock,
      afterCommit: () => undefined,
      // Reads never claim: no track is ever needed.
      tracks: { trackOf: () => Promise.reject(new Error('turf reads need no track')) },
    });
  }

  /** The tag of the user's turf now (version + account epoch). */
  private async tag(userId: string, reader: UserReader): Promise<{ version: number; created: string; etag: string }> {
    const [version, user] = await Promise.all([reader.turf.version(), reader.user()]);
    const created = accountEpoch(userId, user?.createdAt ?? 0);
    return { version, created, etag: turfEtagOf(version, created) };
  }

  /**
   * ListTurfCells, a page at a time in cell id order. The version is read first: on the first page,
   * `ifNoneMatch` naming it answers "not modified" without loading a row (later pages share the tag
   * but not the body, so they never answer 304); a cursor from another version is `410
   * turf.changed` (start again from the first page). A first page the turf keeps changing under
   * (a backup uploading) is `503 turf.busy` with `Retry-After`.
   */
  async cells(userId: string, q: { cursor?: string; limit: number; ifNoneMatch?: string }): Promise<CellsAnswer> {
    const reader = this.store.read(userId);
    const position = q.cursor ? decodeCursor(q.cursor, isCellsPosition) : null;
    if (q.cursor && !position) {
      throw new AppError('invalid-request');
    }
    for (let attempt = 0; attempt < CONSISTENT_READ_TRIES; attempt++) {
      const now = await this.tag(userId, reader);
      if (position && (position.v !== now.version || position.c !== now.created)) {
        throw new AppError('turf.changed');
      }
      if (!position && matchesTag(q.ifNoneMatch, now.etag)) {
        return { notModified: true, etag: now.etag };
      }
      const offset = position?.o ?? 0;
      const page = await this.api(reader).cells.execute({ offset, limit: q.limit });
      const after = await this.tag(userId, reader);
      if (after.etag !== now.etag) {
        // A write committed while the page was read: read it again at the new version (a cursor
        // of the old one is stale by now).
        if (position) {
          throw new AppError('turf.changed');
        }
        continue;
      }
      return {
        notModified: false,
        etag: now.etag,
        turfVersion: now.version,
        total: page.total,
        cells: page.cells as TurfCellRow[],
        nextCursor:
          page.nextOffset === null ? null : encodeCursor({ v: now.version, c: now.created, o: page.nextOffset }),
      };
    }
    // Only a first page gets here (a later one is 410 at once): ask again shortly.
    throw new AppError('turf.busy', { 'Retry-After': String(TURF_BUSY_RETRY_S) });
  }

  /** GetTurfSummary at the server's now (new this week and month are rolling windows). */
  summary(userId: string) {
    return this.api(this.store.read(userId)).summary.execute();
  }

  /**
   * GetClaimForActivity: 404 / 410 for an unknown or deleted activity (as every activity route);
   * 404 when the activity has no claim (a deferred start, or not backfilled yet). "New" cells are
   * the canonical ones (D4).
   */
  async claim(userId: string, activityId: string) {
    const reader = this.store.read(userId);
    await existingActivity(reader, activityId);
    const claim = await this.api(reader).claimOf.execute(activityId);
    if (!claim) {
      throw new AppError('not-found');
    }
    return {
      activityId: claim.activityId,
      cellCount: claim.cellCount,
      newCellCount: claim.newCellCount,
      newAreaKm2: claim.newAreaKm2,
      cells: claim.cells.map((c) => ({ id: c.id, isNew: c.isNew })),
    };
  }
}
