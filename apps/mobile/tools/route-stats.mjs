#!/usr/bin/env node
// Reference ("oracle") stats for a GPX track. Use it to check the app's
// src/metrics/ output against an independent implementation, or to inspect a
// GPX exported from a real device.
//
//   node tools/route-stats.mjs tools/fixtures/run-5k.gpx [--type run] [--json]

import { readFileSync } from 'node:fs';

import { haversine, parseGpx, PROFILES } from './lib/geo.mjs';

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--type');
if (!file) {
  console.error('Usage: node tools/route-stats.mjs <file.gpx> [--type walk|run|cycle] [--json]');
  process.exit(1);
}
const { type: gpxType, points } = parseGpx(readFileSync(file, 'utf8'));
const typeArgIdx = argv.indexOf('--type');
const type = (typeArgIdx >= 0 ? argv[typeArgIdx + 1] : gpxType) ?? 'run';
const profile = PROFILES[type] ?? PROFILES.run;
const asJson = argv.includes('--json');

if (points.length < 2) {
  console.error(`Only ${points.length} track points in ${file}.`);
  process.exit(1);
}

// 1. Raw distance (no filtering) — shows how much noise inflates the total.
let rawDistance = 0;
for (let i = 1; i < points.length; i++) {
  rawDistance += haversine(points[i - 1], points[i]);
}

// 2. Outlier rejection: drop a point if reaching it implies speed > profile.maxSpeed.
const kept = [points[0]];
let rejected = 0;
for (let i = 1; i < points.length; i++) {
  const prev = kept.at(-1);
  const p = points[i];
  const dt = p.t != null && prev.t != null ? (p.t - prev.t) / 1000 : null;
  if (dt != null && dt <= 0) {
    rejected++;
    continue;
  }
  const d = haversine(prev, p);
  if (dt != null && d / dt > profile.maxSpeed) {
    rejected++;
    continue;
  }
  // Jitter filter: ignore fixes closer than minStep to the last kept point,
  // unless enough time passed that we need the timestamp (pause detection).
  if (d < profile.minStep && (dt == null || dt < 10)) {
    continue;
  }
  kept.push(p);
}

// 3. Distance, moving time (segments faster than movingSpeed), splits.
let distance = 0;
let moving = 0;
const splits = [];
let splitStartT = kept[0].t;
let nextSplit = 1000;
for (let i = 1; i < kept.length; i++) {
  const d = haversine(kept[i - 1], kept[i]);
  const dt = kept[i].t != null && kept[i - 1].t != null ? (kept[i].t - kept[i - 1].t) / 1000 : 0;
  const isMoving = dt > 0 && d / dt >= profile.movingSpeed;
  // Stationary jitter does not count toward distance either.
  if (isMoving || dt === 0) {
    distance += d;
  }
  if (isMoving) {
    moving += dt;
  }
  if (distance >= nextSplit && kept[i].t != null) {
    splits.push({ km: nextSplit / 1000, seconds: (kept[i].t - splitStartT) / 1000 });
    splitStartT = kept[i].t;
    nextSplit += 1000;
  }
}

// 4. Elevation gain: 5-point moving average, then hysteresis to ignore noise.
const eles = kept.map((p) => p.ele).filter((e) => e != null);
let gain = 0;
let loss = 0;
if (eles.length > 5) {
  const smooth = eles.map((_, i) => {
    const w = eles.slice(Math.max(0, i - 2), i + 3);
    return w.reduce((s, e) => s + e, 0) / w.length;
  });
  let ref = smooth[0];
  for (const e of smooth) {
    if (e - ref >= profile.elevHysteresis) {
      gain += e - ref;
      ref = e;
    } else if (ref - e >= profile.elevHysteresis) {
      loss += ref - e;
      ref = e;
    }
  }
}

const elapsed = kept.at(-1).t != null && kept[0].t != null ? (kept.at(-1).t - kept[0].t) / 1000 : null;
const fmtDur = (s) =>
  s == null
    ? '—'
    : `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const pace = moving > 0 && distance > 0 ? moving / (distance / 1000) : null; // s per km
const fmtPace = (s) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')} /km`);
const speedKmh = moving > 0 ? distance / 1000 / (moving / 3600) : null;

const result = {
  file,
  type,
  points: points.length,
  rejected,
  rawDistanceM: Math.round(rawDistance),
  distanceM: Math.round(distance),
  elapsedS: elapsed,
  movingS: Math.round(moving),
  paceSPerKm: pace && Math.round(pace),
  speedKmh: speedKmh && Number(speedKmh.toFixed(2)),
  elevGainM: Math.round(gain),
  elevLossM: Math.round(loss),
  splits: splits.map((s) => ({ km: s.km, seconds: Math.round(s.seconds) })),
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`${file}  (${type}, ${points.length} pts, ${rejected} rejected as outliers)`);
  console.log(`distance   ${(distance / 1000).toFixed(2)} km   (raw ${(rawDistance / 1000).toFixed(2)} km)`);
  console.log(`elapsed    ${fmtDur(elapsed)}   moving ${fmtDur(moving)}`);
  console.log(type === 'cycle' ? `speed      ${speedKmh?.toFixed(1)} km/h` : `pace       ${fmtPace(pace)}`);
  console.log(`elevation  +${Math.round(gain)} m / -${Math.round(loss)} m`);
  if (splits.length) {
    console.log(`splits     ${splits.map((s) => `${s.km}km ${fmtPace(s.seconds)}`).join(', ')}`);
  }
}
