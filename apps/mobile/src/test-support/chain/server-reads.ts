/**
 * Reads of one account's server copy, shared by every observer in the sync chain: the phone's own
 * view (bearer token) and the web portal (session cookie) call the same routes, so a difference
 * between what they see is the API's, not the test's. Each read is what a screen shows: the
 * activities list and totals (web Slice 1, the phone's Stats), the turf summary and every turf cell
 * (the web map).
 */
import type { Pending } from './pending';

/** One Turf Cell as the API and the phone's projection both list it: `[h3Id, walk, run, cycle]`. */
export type CellCounts = [string, number, number, number];

export interface TurfSummary {
  cellCount: number;
  strongCells: number;
  byType: { walk: number; run: number; cycle: number };
}

export interface Totals {
  count: number;
  distanceM: number;
  movingS: number;
}

export interface ActivityTotals {
  allTime: Totals;
  byType: { walk: Totals; run: Totals; cycle: Totals };
}

export interface ServerActivityView {
  id: string;
  name: string;
  type: string;
  source: string;
  /** Null on the fake, which stores uploads but computes no numbers. */
  distanceM: number | null;
  movingS: number | null;
}

type Get = (path: string) => Promise<Response>;

async function json<T>(get: Get, path: string): Promise<T> {
  const res = await get(path);
  if (!res.ok) {
    throw new Error(`GET ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Every activity on the server, all pages. */
export async function readActivities(get: Get): Promise<ServerActivityView[]> {
  const out: ServerActivityView[] = [];
  let cursor: string | null = null;
  do {
    const page: { items: ServerActivityView[]; nextCursor: string | null } = await json(
      get,
      `/v1/activities${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
    );
    out.push(
      ...page.items.map(({ id, name, type, source, distanceM, movingS }) => ({
        id,
        name,
        type,
        source,
        distanceM,
        movingS,
      }))
    );
    cursor = page.nextCursor;
  } while (cursor);
  return out;
}

const NO_TURF = (status: number): Pending => ({ pending: `server turf is not on this API (answer ${status})` });

export async function readTurfSummary(get: Get): Promise<TurfSummary | Pending> {
  const res = await get('/v1/turf/summary');
  if (res.status === 501) {
    return NO_TURF(501);
  }
  if (!res.ok) {
    throw new Error(`GET /v1/turf/summary → ${res.status}`);
  }
  const { cellCount, strongCells, byType } = (await res.json()) as TurfSummary;
  return { cellCount, strongCells, byType: { walk: byType.walk ?? 0, run: byType.run ?? 0, cycle: byType.cycle ?? 0 } };
}

/**
 * Every turf cell, page by page, as the web map downloads them. A page cursor is bound to a turf
 * version: a `410 turf.changed` mid-download means the turf moved under the reader, which a chain
 * scenario never does between its checks, so it fails.
 */
export async function readTurfCells(get: Get): Promise<{ cells: CellCounts[]; cacheControl: string | null } | Pending> {
  const cells: CellCounts[] = [];
  let cursor: string | null = null;
  let cacheControl: string | null = null;
  do {
    const path = `/v1/turf/cells?limit=500${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const res = await get(path);
    if (res.status === 404 || res.status === 501) {
      return NO_TURF(res.status);
    }
    if (!res.ok) {
      throw new Error(`GET ${path} → ${res.status}`);
    }
    cacheControl ??= res.headers.get('cache-control');
    const page = (await res.json()) as { cells: CellCounts[]; nextCursor: string | null };
    cells.push(...page.cells);
    cursor = page.nextCursor;
  } while (cursor);
  return { cells: sortCells(cells), cacheControl };
}

export async function readTotals(get: Get): Promise<ActivityTotals | Pending> {
  const res = await get('/v1/activity-totals');
  if (res.status === 404 || res.status === 501) {
    return { pending: `activity totals are not on this API (answer ${res.status})` };
  }
  if (!res.ok) {
    throw new Error(`GET /v1/activity-totals → ${res.status}`);
  }
  return (await res.json()) as ActivityTotals;
}

/** Cells in one order (H3 ids are lower-case hex: plain string order matches the API's `COLLATE "C"`). */
export function sortCells(cells: CellCounts[]): CellCounts[] {
  return [...cells].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
