/**
 * G2 turf parity, API side: the operations of core's golden fixture
 * (packages/core/src/contexts/territory/__fixtures__/turf-parity.json) replayed through the HTTP
 * upload, replace and delete routes give the golden projection — summary, every cell with its
 * counts and first time, and each claim's canonical "new" cells (D4). The phone and core assert the
 * same golden. Read through the use cases (`createTurfApi` over the repository) and through the
 * routes (`/v1/turf/summary`, the paged `/v1/turf/cells`, `/v1/turf/claims/…`). Runs twice: on PGlite's C collation and with the two first-claimer id columns linguistic (ICU), as they may be on Neon; the other orderings are left to the Neon check.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createTurfApi } from '@cityturfer/core/territory';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { CompactPoint } from '../backup/model';
import { backupApp, closeSharedDb } from './support';

const FIXTURES = path.join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'core',
  'src',
  'contexts',
  'territory',
  '__fixtures__'
);

interface Activity {
  id: string;
  type: 'walk' | 'run' | 'cycle';
  source: 'recording' | 'apple-health' | 'import';
  startedAt: number;
  endedAt: number;
  points: CompactPoint[];
}
type Operation = { op: 'create' | 'replace-track' | 'change-type'; activity: Activity } | { op: 'delete'; id: string };
interface Expected {
  now: number;
  summary: {
    cellCount: number;
    areaKm2: number;
    strongCells: number;
    newThisWeekKm2: number;
    newThisMonthKm2: number;
    byType: Record<string, number>;
  };
  claims: { activityId: string; cellCount: number; newCellCount: number; newAreaKm2: number }[];
  cells: [id: string, walk: number, run: number, cycle: number, firstAt: number][];
}

const input = JSON.parse(readFileSync(path.join(FIXTURES, 'turf-parity.json'), 'utf8')) as {
  now: number;
  operations: Operation[];
};
const expected = JSON.parse(readFileSync(path.join(FIXTURES, 'turf-parity.expected.json'), 'utf8')) as Expected;

let h: Awaited<ReturnType<typeof backupApp>>;
beforeEach(async () => {
  h = await backupApp();
});
afterAll(closeSharedDb);

const iso = (t: number) => new Date(t).toISOString();

async function replay() {
  h.clock.t = input.now;
  for (const purpose of ['cloud-sync', 'apple-health-in-cloud-sync']) {
    await h.call('PUT', `/v1/me/consents/${purpose}`, { body: { granted: true, policyVersion: '2026-10' } });
  }
  const etags = new Map<string, string>();
  for (const o of input.operations) {
    if (o.op === 'delete') {
      expect((await h.call('DELETE', `/v1/activities/${o.id}`)).status).toBe(204);
      continue;
    }
    const a = o.activity;
    const ifMatch = o.op === 'create' ? undefined : etags.get(a.id);
    const res = await h.call('PUT', `/v1/activities/${a.id}`, {
      headers: ifMatch ? { 'If-Match': ifMatch } : {},
      body: {
        type: a.type,
        name: 'Parity',
        source: a.source,
        startedAt: iso(a.startedAt),
        endedAt: iso(a.endedAt),
        timeZone: 'Europe/Warsaw',
        resumedSegments: null,
        track: { points: a.points },
      },
    });
    expect(res.status, `${o.op} ${a.id}`).toBe(o.op === 'create' ? 201 : 200);
    etags.set(a.id, res.headers.get('ETag')!);
  }
}

async function expectGolden() {
  const repo = h.store.read('admin').turf;
  const turf = createTurfApi({
    repo,
    grid: h.grid,
    clock: { now: () => expected.now },
    tracks: { trackOf: () => Promise.resolve([]) },
    afterCommit: () => undefined,
  });
  const s = await turf.summary.execute();
  const g = expected.summary;
  expect({ cellCount: s.cellCount, strongCells: s.strongCells, byType: s.byType }).toEqual({
    cellCount: g.cellCount,
    strongCells: g.strongCells,
    byType: g.byType,
  });
  for (const k of ['areaKm2', 'newThisWeekKm2', 'newThisMonthKm2'] as const) {
    expect(Math.abs(s[k] - g[k]), k).toBeLessThan(1e-9);
  }

  const cells = (await repo.allCells())
    .map((r) => [r.cell, r.walk, r.run, r.cycle, r.firstAt])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  expect(cells).toEqual(expected.cells);
  const page = await turf.cells.execute({ offset: 0, limit: 100_000 });
  expect(page.cells).toEqual(expected.cells.map(([id, w, r, c]) => [id, w, r, c]));

  for (const claim of expected.claims) {
    const v = await turf.claimOf.execute(claim.activityId);
    expect(v && { cellCount: v.cellCount, newCellCount: v.newCellCount }, claim.activityId).toEqual({
      cellCount: claim.cellCount,
      newCellCount: claim.newCellCount,
    });
    expect(Math.abs(v!.newAreaKm2 - claim.newAreaKm2)).toBeLessThan(1e-9);
  }
  // The routes answer the same: the summary at the golden's now, the whole cell download (small
  // pages, so the cursor is exercised), and each claim's numbers.
  h.clock.t = expected.now;
  const summary = (await (await h.call('GET', '/v1/turf/summary')).json()) as typeof s;
  expect({ cellCount: summary.cellCount, strongCells: summary.strongCells, byType: summary.byType }).toEqual({
    cellCount: g.cellCount,
    strongCells: g.strongCells,
    byType: g.byType,
  });
  for (const k of ['areaKm2', 'newThisWeekKm2', 'newThisMonthKm2'] as const) {
    expect(Math.abs(summary[k] - g[k]), `route ${k}`).toBeLessThan(1e-9);
  }
  const downloaded: unknown[] = [];
  let cursor: string | null = null;
  do {
    const res = await h.call('GET', `/v1/turf/cells?limit=4${cursor ? `&cursor=${cursor}` : ''}`);
    expect(res.status).toBe(200);
    const page = (await res.json()) as { cells: unknown[]; nextCursor: string | null; total: number };
    expect(page.total).toBe(expected.cells.length);
    downloaded.push(...page.cells);
    cursor = page.nextCursor;
  } while (cursor);
  expect(downloaded).toEqual(expected.cells.map(([id, w, r, c]) => [id, w, r, c]));
  for (const claim of expected.claims) {
    const res = await h.call('GET', `/v1/turf/claims/${claim.activityId}`);
    const v = (await res.json()) as { cellCount: number; newCellCount: number; newAreaKm2: number };
    expect({ cellCount: v.cellCount, newCellCount: v.newCellCount }, `route ${claim.activityId}`).toEqual({
      cellCount: claim.cellCount,
      newCellCount: claim.newCellCount,
    });
    expect(Math.abs(v.newAreaKm2 - claim.newAreaKm2)).toBeLessThan(1e-9);
  }

  // Only the surviving claims exist (the deleted activity's is gone).
  const result = await h.db.execute(sql`SELECT activity_id FROM turf_claims WHERE user_id = 'admin'`);
  const ids = (result as unknown as { rows: { activity_id: string }[] }).rows;
  expect(ids.map((r) => r.activity_id).sort()).toEqual(expected.claims.map((c) => c.activityId).sort());
}

describe('G2 turf parity (API)', () => {
  it('replays the fixture through the routes and matches the golden', async () => {
    await replay();
    await expectGolden();
  });

  it('matches the golden with linguistically collated id columns (Neon-like default)', async () => {
    const collate = async (c: string) => {
      await h.db.execute(sql.raw(`ALTER TABLE turf_claims ALTER COLUMN activity_id TYPE text COLLATE ${c}`));
      await h.db.execute(sql.raw(`ALTER TABLE turf_cells ALTER COLUMN first_activity_id TYPE text COLLATE ${c}`));
    };
    await collate('"und-x-icu"');
    try {
      await replay();
      await expectGolden();
    } finally {
      await collate('"default"');
    }
  });
});
