/**
 * Scenario helpers for the sync chain: put activities on a phone the way the app does, take a
 * snapshot of what the phone holds, and note checks that cannot run yet ("pending", never "pass").
 */
import { appendFileSync } from 'node:fs';

import type { ActivityType, TrackPoint } from '@/shared-kernel';
import { loadFixes } from '@/test-support/fixtures';

import type { ChainPhone } from './chain-server';
import { isPending, type Pending } from './pending';
import { type ActivityTotals, type CellCounts, sortCells, type Totals, type TurfSummary } from './server-reads';

type Container = ChainPhone['c'];

const points = (gpx: string): TrackPoint[] =>
  loadFixes(gpx).map((f) => ({ ...f, segment: 0, accuracy: 5, speed: null }));

/** An activity with a chosen id (an import, like Apple Health or the demo history). */
export async function addActivity(c: Container, id: string, type: ActivityType, gpx: string): Promise<void> {
  await c.activityLog.importActivity.execute({ id, type, points: points(gpx) });
  await c.dispatcher.dispatchPending();
}

/**
 * Turns backup on and runs it until nothing is in flight. The app may already be running one in the
 * background (the outbox starts runs), so callers check the outcome on the server and in the
 * backup status, not in this run's report.
 */
export async function turnBackupOn(c: Container): Promise<void> {
  const on = await c.cloudBackup.enable.execute();
  if (on.kind !== 'ok') {
    throw new Error(`backup did not turn on: ${JSON.stringify(on)}`);
  }
  await settleBackup(c);
}

/** One backup run now, after and before waiting for any run already going. */
export async function settleBackup(c: Container) {
  await c.cloudBackup.run.whenIdle();
  const r = await c.cloudBackup.run.execute({ now: true });
  await c.cloudBackup.run.whenIdle();
  return r;
}

/** Everything a server-side action must never change on the phone. */
export async function phoneSnapshot(c: Container) {
  const list = await c.activityLog.list.execute(1000);
  const details = await Promise.all(list.map((x) => c.activityLog.detail.execute(x.id)));
  return {
    activities: details
      .map((d) => ({
        id: d!.id,
        type: d!.type,
        name: d!.name,
        distanceM: d!.distanceM,
        movingS: d!.movingS,
        points: d!.track.length,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    cells: (await c.territory.summary.execute()).cellCount,
    homeCity: (await c.territory.homeCityChoice.execute())?.cityId ?? null,
  };
}

/**
 * Notes a check that could not run. Written to CHAIN_REPORT (one JSON line each) when the chain
 * runner sets it, and the runner lists them apart from the passes; printed to stderr otherwise.
 */
export function notYet(server: string, check: string, p: Pending): void {
  const file = process.env.CHAIN_REPORT;
  if (file) {
    appendFileSync(file, `${JSON.stringify({ server, check, pending: p.pending })}\n`);
  } else {
    // Outside the runner nothing lists pending checks, and the test itself shows green: say so.
    process.stderr.write(`PENDING, NOT RUN [${server}] ${check}: ${p.pending}\n`);
  }
}

/** The phone's own turf: its summary and every cell with its visits per type (Territory projection). */
export async function phoneTurf(c: Container): Promise<{ summary: TurfSummary; cells: CellCounts[] }> {
  const { cellCount, strongCells, byType } = await c.territory.summary.execute();
  const cells: CellCounts[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page = await c.territory.cells.execute({ offset, limit: 1000 });
    cells.push(...(page.cells as CellCounts[]));
    offset = page.nextOffset;
  }
  return { summary: { cellCount, strongCells, byType }, cells: sortCells(cells) };
}

/** What the phone's Stats tab counts, from a snapshot (no gap estimates: gap routing is off in the chain). */
export function phoneTotals(snapshot: Awaited<ReturnType<typeof phoneSnapshot>>): ActivityTotals {
  const sum = (type?: string): Totals => {
    const xs = snapshot.activities.filter((a) => !type || a.type === type);
    return {
      count: xs.length,
      distanceM: xs.reduce((t, a) => t + a.distanceM, 0),
      movingS: xs.reduce((t, a) => t + a.movingS, 0),
    };
  };
  return { allTime: sum(), byType: { walk: sum('walk'), run: sum('run'), cycle: sum('cycle') } };
}

/** The turf reads every observer has (the phone's server view, the web portal). */
export interface TurfReads {
  turfSummary(): Promise<TurfSummary | Pending>;
  turfCells(): Promise<CellCounts[] | Pending>;
}

/**
 * The server's turf is the phone's, cell for cell: same H3 ids, same visits per type, same summary.
 * Both sides claim with the same @cityturfer/core, so any difference is a bug, not rounding.
 * `expected` replaces the phone's cells when the server should hold less than the phone (Apple
 * Health not shared): the phone never loses turf for a server-side choice.
 */
export async function expectTurfMatches(
  server: string,
  check: string,
  reads: TurfReads,
  c: Container,
  expected?: (phone: CellCounts[]) => CellCounts[]
): Promise<void> {
  const [summary, cells] = await Promise.all([reads.turfSummary(), reads.turfCells()]);
  if (isPending(summary) || isPending(cells)) {
    notYet(server, check, isPending(summary) ? summary : (cells as Pending));
    return;
  }
  const phone = await phoneTurf(c);
  const want = expected ? sortCells(expected(phone.cells)) : phone.cells;
  expect(cells).toEqual(want);
  expect(summary.cellCount).toBe(want.length);
  if (!expected) {
    expect(summary).toEqual(phone.summary);
  }
}

/** The server's totals are the phone's Stats: counts exact, distance within 1 m and time within 1 s per activity. */
export async function expectTotalsMatch(
  server: string,
  check: string,
  read: () => Promise<ActivityTotals | Pending>,
  c: Container
): Promise<void> {
  const totals = await read();
  if (isPending(totals)) {
    notYet(server, check, totals);
    return;
  }
  const phone = phoneTotals(await phoneSnapshot(c));
  const close = (got: Totals, want: Totals) => {
    expect(got.count).toBe(want.count);
    expect(Math.abs(got.distanceM - want.distanceM)).toBeLessThan(Math.max(1, want.count));
    expect(Math.abs(got.movingS - want.movingS)).toBeLessThanOrEqual(Math.max(1, want.count));
  };
  close(totals.allTime, phone.allTime);
  for (const t of ['walk', 'run', 'cycle'] as const) {
    close(totals.byType[t], phone.byType[t]);
  }
}

/**
 * The phone's cells less one walk visit on every walked cell: what the server holds once an Apple
 * Health walk that followed the same route as a recorded walk is no longer shared.
 */
export function withoutOneWalk(cells: CellCounts[]): CellCounts[] {
  return cells
    .map(([id, walk, run, cycle]): CellCounts => [id, walk > 0 ? walk - 1 : 0, run, cycle])
    .filter(([, walk, run, cycle]) => walk + run + cycle > 0);
}
