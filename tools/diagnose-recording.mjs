#!/usr/bin/env node
/**
 * Explains gaps in a real-device recording WITHOUT printing coordinates:
 * a minute-by-minute timeline of location batches (app state, fixes received /
 * accepted / rejected, worst accuracy), app-state changes, launches and task
 * errors, plus track-point gaps and accuracy per segment.
 *
 *   node tools/diagnose-recording.mjs <path/to/turftrack-<uid>.db> [--session <id>]
 *
 * Defaults to the most recently started recording session.
 */
import Database from 'better-sqlite3';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const sessionArg = args.includes('--session') ? args[args.indexOf('--session') + 1] : null;
if (!file) {
  console.error('usage: node tools/diagnose-recording.mjs <db> [--session <id>]');
  process.exit(1);
}

const db = new Database(file, { readonly: true });
const session = sessionArg
  ? db.prepare('SELECT id, type, status, started_at, updated_at FROM rec_sessions WHERE id = ?').get(sessionArg)
  : db
      .prepare('SELECT id, type, status, started_at, updated_at FROM rec_sessions ORDER BY started_at DESC LIMIT 1')
      .get();
if (!session) {
  console.error('no recording session found');
  process.exit(1);
}

const clock = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour12: false });
const min = (ms) => ((ms - session.started_at) / 60000).toFixed(1).padStart(5);
const from = session.started_at - 60_000;
const to = session.updated_at + 60_000;

console.log(`session ${session.id}  ${session.type}  ${session.status}`);
console.log(
  `  ${clock(session.started_at)} → ${clock(session.updated_at)}  (${((session.updated_at - session.started_at) / 60000).toFixed(1)} min)`
);

const activity = db
  .prepare(
    'SELECT id, distance_m, moving_s, elapsed_s FROM log_activities WHERE started_at BETWEEN ? AND ? ORDER BY started_at DESC LIMIT 1'
  )
  .get(from, to);
if (activity) {
  console.log(
    `  activity: ${(activity.distance_m / 1000).toFixed(2)} km, moving ${(activity.moving_s / 60).toFixed(1)} min, elapsed ${(activity.elapsed_s / 60).toFixed(1)} min`
  );
}

// --- Track points: no coordinates, only timing / accuracy per segment ---------
const points = activity
  ? db.prepare('SELECT segment, t, accuracy FROM log_track_points WHERE activity_id = ? ORDER BY seq').all(activity.id)
  : db.prepare('SELECT segment, t, accuracy FROM rec_track_points WHERE session_id = ? ORDER BY seq').all(session.id);
console.log(`\ntrack points: ${points.length}`);
const segments = new Map();
for (const p of points) {
  const s = segments.get(p.segment) ?? { n: 0, first: p.t, last: p.t, acc: [] };
  s.n++;
  s.last = p.t;
  if (p.accuracy != null) s.acc.push(p.accuracy);
  segments.set(p.segment, s);
}
for (const [seg, s] of segments) {
  const acc = s.acc.sort((a, b) => a - b);
  const med = acc.length ? acc[Math.floor(acc.length / 2)].toFixed(0) : '-';
  console.log(`  segment ${seg}: min ${min(s.first)} → ${min(s.last)}  ${s.n} pts  median accuracy ${med} m`);
}
const gaps = [];
for (let i = 1; i < points.length; i++) {
  const dt = points[i].t - points[i - 1].t;
  if (dt > 20_000) gaps.push(`  min ${min(points[i - 1].t)}: ${(dt / 1000).toFixed(0)} s without accepted points`);
}
console.log(gaps.length ? `gaps > 20 s:\n${gaps.join('\n')}` : 'no gaps > 20 s');

// --- Diagnostics timeline -------------------------------------------------------
const rows = db
  .prepare('SELECT at, kind, data FROM sys_diagnostics WHERE at BETWEEN ? AND ? ORDER BY at')
  .all(from, to);
console.log(`\ndiagnostics rows in window: ${rows.length}`);
console.log(' min   time      event');
const buckets = new Map();
const flush = (key) => {
  const b = buckets.get(key);
  if (!b) return;
  const rej = Object.entries(b.rejected)
    .filter(([, n]) => n)
    .map(([k, n]) => `${k}:${n}`)
    .join(' ');
  console.log(
    `${min(b.at)}  ${clock(b.at)}  batches ${String(b.batches).padStart(3)}  recv ${String(b.received).padStart(4)}  ok ${String(b.accepted).padStart(4)}` +
      `  maxAcc ${String(Math.round(b.maxAcc)).padStart(3)} m  [${[...b.states].join(',')}] [${[...b.status].join(',')}]` +
      (rej ? `  rejected ${rej}` : '') +
      (b.jitter ? `  jitter ${b.jitter}` : '') +
      (b.gapSplits ? `  gapSplits ${b.gapSplits}` : '') +
      (b.paused ? `  ignoredPaused ${b.paused}` : '') +
      (b.other.size ? `  result ${[...b.other].join(',')}` : '')
  );
  buckets.delete(key);
};
let lastKey = null;
for (const r of rows) {
  const d = JSON.parse(r.data);
  if (r.kind !== 'batch') {
    if (lastKey != null) flush(lastKey);
    lastKey = null;
    const detail = r.kind === 'task-error' ? `${d.code} ${d.message}` : JSON.stringify(d);
    console.log(`${min(r.at)}  ${clock(r.at)}  ** ${r.kind} ${detail}`);
    continue;
  }
  const key = Math.floor(r.at / 60000);
  if (lastKey != null && key !== lastKey) flush(lastKey);
  lastKey = key;
  const b = buckets.get(key) ?? {
    at: r.at,
    batches: 0,
    received: 0,
    accepted: 0,
    maxAcc: 0,
    jitter: 0,
    gapSplits: 0,
    paused: 0,
    rejected: {},
    states: new Set(),
    status: new Set(),
    other: new Set(),
  };
  b.batches++;
  b.received += d.received ?? 0;
  b.accepted += d.accepted ?? 0;
  b.maxAcc = Math.max(b.maxAcc, d.maxAccuracy ?? 0);
  b.jitter += d.jitter ?? 0;
  b.gapSplits += d.gapSplits ?? 0;
  b.paused += d.ignoredWhilePaused ?? 0;
  for (const [k, n] of Object.entries(d.rejected ?? {})) b.rejected[k] = (b.rejected[k] ?? 0) + n;
  if (d.appState) b.states.add(d.appState);
  if (d.status) b.status.add(d.status);
  if (d.result) b.other.add(d.result);
  buckets.set(key, b);
}
if (lastKey != null) flush(lastKey);
