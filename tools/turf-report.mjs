#!/usr/bin/env node
/**
 * Per-activity turf report WITHOUT coordinates: recorded vs estimated distance,
 * segments, cells claimed and cells per recorded km (a straight corridor of
 * H3 res-11 cells is ~40–60 cells/km), plus territory totals.
 *
 *   node tools/turf-report.mjs <path/to/turftrack-<uid>.db>
 */
import Database from 'better-sqlite3';

const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/turf-report.mjs <db>');
  process.exit(1);
}
const db = new Database(file, { readonly: true });
const cols = new Set(
  db
    .prepare('PRAGMA table_info(log_activities)')
    .all()
    .map((c) => c.name)
);
const est = cols.has('estimated_m') ? 'a.estimated_m' : '0';
const rows = db
  .prepare(
    `SELECT a.id, a.type, a.started_at, a.distance_m, ${est} AS estimated_m, a.elapsed_s,
            (SELECT COUNT(DISTINCT segment) FROM log_track_points p WHERE p.activity_id = a.id) AS segments,
            (SELECT COUNT(*) FROM log_track_points p WHERE p.activity_id = a.id) AS points,
            c.cell_count, c.new_cell_count
     FROM log_activities a LEFT JOIN ter_claims c ON c.activity_id = a.id ORDER BY a.started_at`
  )
  .all();
const when = (ms) => new Date(ms).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
console.log('started            type   recorded  estimated  elapsed  segs  pts  cells  new  cells/km');
for (const r of rows) {
  const km = r.distance_m / 1000;
  console.log(
    `${when(r.started_at).padEnd(18)} ${r.type.padEnd(6)} ${km.toFixed(2).padStart(6)} km ${(r.estimated_m / 1000).toFixed(2).padStart(6)} km` +
      ` ${String(Math.round(r.elapsed_s / 60)).padStart(5)} m ${String(r.segments).padStart(5)} ${String(r.points).padStart(4)}` +
      ` ${String(r.cell_count ?? '-').padStart(6)} ${String(r.new_cell_count ?? '-').padStart(4)} ${km > 0 && r.cell_count ? (r.cell_count / km).toFixed(0).padStart(9) : '        -'}`
  );
}
const t = db
  .prepare('SELECT COUNT(*) AS n, SUM(walk > 0) AS walk, SUM(run > 0) AS run, SUM(cycle > 0) AS cycle FROM ter_cells')
  .get();
const claimed = db.prepare('SELECT COUNT(DISTINCT cell) AS n FROM ter_claim_cells').get();
const orphan = db
  .prepare(
    'SELECT COUNT(*) AS n FROM ter_claims c WHERE NOT EXISTS (SELECT 1 FROM log_activities a WHERE a.id = c.activity_id)'
  )
  .get();
const unclaimed = rows.filter((r) => r.cell_count == null).length;
console.log(
  `\nterritory: ${t.n} cells (walk ${t.walk}, run ${t.run}, ride ${t.cycle}); distinct claimed cells ${claimed.n}`
);
console.log(`activities without a claim: ${unclaimed}; claims without an activity: ${orphan.n}`);
const pending = db.prepare('SELECT type, COUNT(*) AS n FROM sys_outbox WHERE processed_at IS NULL GROUP BY type').all();
console.log(`pending events: ${pending.length ? pending.map((p) => `${p.type}×${p.n}`).join(', ') : 'none'}`);
const jobs = cols.has('estimated_m') ? db.prepare('SELECT name, result FROM sys_jobs').all() : [];
for (const j of jobs) console.log(`job ${j.name}: ${j.result}`);
