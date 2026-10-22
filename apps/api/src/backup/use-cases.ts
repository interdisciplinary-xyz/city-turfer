import { catalogueCityView } from '@cityturfer/core/territory';

import { AppError } from './app-error';
import { contentHashOf, trackHashOf } from './hashing';
import type {
  ActivityRecord,
  ActivitySourceName,
  ActivityTypeName,
  ChangeRecord,
  CompactPoint,
  ConsentPurposeName,
  ConsentRecord,
  GapRoutesRecord,
  HomeCityRecord,
  StoredGapRoute,
  UserRecord,
} from './model';
import type { BackupStore, UserReader } from './ports';
import { gapTotals, summarizeUpload } from './summary';

/**
 * One-way backup phone → server (docs/decisions/api-sync-2026-10-20.md, "Sync protocol"): the
 * application layer behind the live routes. Handlers parse and format; the rules of replay,
 * preconditions, tombstones, consent and last-write-wins live here, the Activity rules in
 * @cityturfer/core.
 */

export interface Clock {
  now(): number;
}

export const etagOf = (version: number) => `"v${version}"`;

/** `If-Match` names this version (`"v3"`, `W/"v3"` or a list containing it)? */
export function matchesVersion(ifMatch: string, version: number): boolean {
  const wanted = etagOf(version);
  return ifMatch.split(',').some((tag) => tag.trim().replace(/^W\//, '') === wanted);
}

async function requireConsent(reader: UserReader, purpose: ConsentPurposeName): Promise<void> {
  const consent = (await reader.consents()).find((c) => c.purpose === purpose);
  if (!consent?.granted) {
    throw new AppError('consent.required');
  }
}

/** The activity, or 404 when the user never had it and 410 when it was deleted. */
async function existingActivity(reader: UserReader, id: string): Promise<ActivityRecord> {
  const activity = await reader.activity(id);
  if (activity) {
    return activity;
  }
  throw new AppError((await reader.tombstone(id)) ? 'activity.deleted' : 'not-found');
}

export interface UploadInput {
  type: ActivityTypeName;
  name: string;
  source: ActivitySourceName;
  startedAt: number;
  endedAt: number;
  timeZone: string | null;
  resumedSegments: number[] | null;
  trackHash?: string;
  points: CompactPoint[];
}

export class BackupService {
  constructor(
    private readonly store: BackupStore,
    private readonly clock: Clock
  ) {}

  // ------------------------------------------------------------------ Identity and consents

  async me(userId: string): Promise<UserRecord> {
    return (await this.store.read(userId).user()) ?? { id: userId, email: null, displayName: null };
  }

  consents(userId: string): Promise<ConsentRecord[]> {
    return this.store.read(userId).consents();
  }

  /** Gives or withdraws a consent. Withdrawing stops writes; it erases nothing (that is DELETE /v1/me). */
  async setConsent(
    userId: string,
    purpose: ConsentPurposeName,
    decision: { granted: boolean; policyVersion: string }
  ): Promise<ConsentRecord[]> {
    return this.store.write(userId, async (tx) => {
      await tx.putConsent({ purpose, ...decision, at: this.clock.now() });
      return tx.consents();
    });
  }

  // ------------------------------------------------------------------ Activities

  /**
   * UploadActivity: create (201), replay (200, unchanged), replace with `If-Match` (200, version
   * + 1; 428 without it, 412 when stale), 410 after a delete. The summary is recomputed with the
   * core; a `trackHash` the client sent must match the canonical one (422).
   */
  async upload(
    userId: string,
    id: string,
    input: UploadInput,
    ifMatch: string | undefined
  ): Promise<{ created: boolean; activity: ActivityRecord }> {
    const now = this.clock.now();
    const trackHash = trackHashOf(input.points);
    if (input.trackHash !== undefined && input.trackHash !== trackHash) {
      throw new AppError('activity.track-hash-mismatch');
    }
    const { name, summary } = summarizeUpload({ id, ...input, now });
    const timeZone = input.timeZone;
    const contentHash = contentHashOf({ ...input, name, timeZone, trackHash });

    return this.store.write(userId, async (tx) => {
      await requireConsent(tx, 'cloud-sync');
      if (input.source === 'apple-health') {
        await requireConsent(tx, 'apple-health-in-cloud-sync');
      }
      await tx.lock();
      if (await tx.tombstone(id)) {
        throw new AppError('activity.deleted');
      }
      const existing = await tx.activity(id);
      if (existing && existing.contentHash === contentHash) {
        return { created: false, activity: existing };
      }
      if (existing && !ifMatch) {
        throw new AppError('precondition-required', { ETag: etagOf(existing.version) });
      }
      if (existing && ifMatch && !matchesVersion(ifMatch, existing.version)) {
        throw new AppError('precondition-failed', { ETag: etagOf(existing.version) });
      }
      const trackChanged = !existing || existing.trackHash !== trackHash;
      const record: ActivityRecord = {
        id,
        type: input.type,
        name,
        source: input.source,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        timeZone,
        resumedSegments: input.resumedSegments,
        trackHash,
        contentHash,
        summary,
        // A new track renumbers its segments: the old gap routes no longer fit, the phone re-sends them.
        estimatedDistanceM: !existing || trackChanged ? 0 : existing.estimatedDistanceM,
        estimatedMovingS: !existing || trackChanged ? 0 : existing.estimatedMovingS,
        version: existing ? existing.version + 1 : 1,
        updatedAt: now,
        changeSeq: await tx.nextSeq(),
      };
      if (!existing) {
        await tx.insertActivity(record, input.points);
        return { created: true, activity: record };
      }
      if (trackChanged) {
        await tx.putGapRoutes(id, null);
        await tx.updateActivity(record, input.points);
      } else {
        await tx.updateActivity(record);
      }
      return { created: false, activity: record };
    });
  }

  /**
   * DeleteActivity: removes the activity, its track and gap routes and leaves a tombstone
   * (delete wins, D5). Idempotent. Allowed without consent: it only removes data.
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.store.write(userId, async (tx) => {
      await tx.lock();
      if (await tx.tombstone(id)) {
        return;
      }
      const changeSeq = await tx.nextSeq();
      await tx.deleteActivity(id);
      await tx.putTombstone({ activityId: id, deletedAt: this.clock.now(), changeSeq });
    });
  }

  /** SaveGapRoutes: replaces the phone's estimates (display only); version + 1 when they changed. */
  async saveGapRoutes(
    userId: string,
    id: string,
    input: { checkedAt: number; routes: StoredGapRoute[] }
  ): Promise<ActivityRecord> {
    return this.store.write(userId, async (tx) => {
      await requireConsent(tx, 'cloud-sync');
      await tx.lock();
      const existing = await existingActivity(tx, id);
      const current = await tx.gapRoutes(id);
      if (sameRoutes(current?.routes ?? [], input.routes)) {
        return existing;
      }
      const totals = gapTotals(input.routes);
      const record: ActivityRecord = {
        ...existing,
        estimatedDistanceM: totals.distanceM,
        estimatedMovingS: totals.movingS,
        version: existing.version + 1,
        updatedAt: this.clock.now(),
        changeSeq: await tx.nextSeq(),
      };
      await tx.putGapRoutes(id, input.routes.length > 0 ? input : null);
      await tx.updateActivity(record);
      return record;
    });
  }

  async activity(userId: string, id: string): Promise<{ activity: ActivityRecord; gapRoutes: GapRoutesRecord | null }> {
    const reader = this.store.read(userId);
    const activity = await existingActivity(reader, id);
    return { activity, gapRoutes: await reader.gapRoutes(id) };
  }

  async track(userId: string, id: string): Promise<{ activity: ActivityRecord; points: CompactPoint[] }> {
    const reader = this.store.read(userId);
    const activity = await existingActivity(reader, id);
    const points = await reader.track(id);
    if (!points) {
      throw new AppError('not-found');
    }
    return { activity, points };
  }

  async list(
    userId: string,
    q: { limit: number; type?: ActivityTypeName; cursor?: string }
  ): Promise<{ items: ActivityRecord[]; nextCursor: string | null }> {
    const before = q.cursor ? (decodeCursor(q.cursor, isListPosition) ?? undefined) : undefined;
    if (q.cursor && !before) {
      throw new AppError('invalid-request');
    }
    const rows = await this.store.read(userId).listActivities({ limit: q.limit + 1, type: q.type, before });
    const items = rows.slice(0, q.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: rows.length > q.limit && last ? encodeCursor({ startedAt: last.startedAt, id: last.id }) : null,
    };
  }

  // ------------------------------------------------------------------ Sync

  /** ListChanges: upserts, tombstones and the Home City above the cursor; no cursor = everything. */
  async changes(
    userId: string,
    q: { cursor?: string; limit: number }
  ): Promise<{ changes: ChangeRecord[]; nextCursor: string; hasMore: boolean }> {
    const reader = this.store.read(userId);
    let after = 0;
    if (q.cursor) {
      const position = decodeCursor(q.cursor, isFeedPosition);
      if (!position || position.seq > (await reader.currentSeq())) {
        throw new AppError('sync.cursor-expired');
      }
      after = position.seq;
    }
    const rows = await reader.changesSince(after, q.limit + 1);
    const changes = rows.slice(0, q.limit);
    return {
      changes,
      nextCursor: encodeCursor({ seq: changes.at(-1)?.seq ?? after }),
      hasMore: rows.length > q.limit,
    };
  }

  // ------------------------------------------------------------------ Home City

  homeCity(userId: string): Promise<HomeCityRecord | null> {
    return this.store.read(userId).homeCity();
  }

  /** ChooseHomeCity: catalogue cities only (422); the latest `chosenAt` wins, older choices are ignored. */
  async chooseHomeCity(userId: string, input: { cityId: string | null; chosenAt: number }): Promise<HomeCityRecord> {
    if (input.cityId !== null) {
      catalogueCityView(input.cityId);
    }
    return this.store.write(userId, async (tx) => {
      await requireConsent(tx, 'cloud-sync');
      await tx.lock();
      const current = await tx.homeCity();
      if (current && current.chosenAt >= input.chosenAt) {
        return current;
      }
      const next: HomeCityRecord = { ...input, recordedAt: this.clock.now(), changeSeq: await tx.nextSeq() };
      await tx.putHomeCity(next);
      return next;
    });
  }
}

/** Equal gap routes, whatever the key order (jsonb does not keep it). */
function sameRoutes(a: readonly StoredGapRoute[], b: readonly StoredGapRoute[]): boolean {
  const canonical = (routes: readonly StoredGapRoute[]) =>
    JSON.stringify(routes.map((r) => [r.afterSegment, r.distanceM, r.movingS, r.coords]));
  return canonical(a) === canonical(b);
}

/** The catalogue city of a stored id, or null (cleared, or no longer in the catalogue). */
export function cityViewOf(cityId: string | null) {
  if (cityId === null) {
    return null;
  }
  try {
    return catalogueCityView(cityId);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ Cursors (opaque to clients)

const isListPosition = (v: unknown): v is { startedAt: number; id: string } =>
  !!v &&
  typeof v === 'object' &&
  Number.isSafeInteger((v as { startedAt?: unknown }).startedAt) &&
  typeof (v as { id?: unknown }).id === 'string';

const isFeedPosition = (v: unknown): v is { seq: number } =>
  !!v && typeof v === 'object' && Number.isSafeInteger((v as { seq?: unknown }).seq) && (v as { seq: number }).seq >= 0;

function encodeCursor(value: object): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeCursor<T>(cursor: string, guard: (v: unknown) => v is T): T | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return guard(value) ? value : null;
  } catch {
    return null;
  }
}
