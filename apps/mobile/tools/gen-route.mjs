#!/usr/bin/env node
// Generate a synthetic, reproducible GPS track for a walk, run or ride.
// Includes realistic GPS noise, optional outlier spikes and an optional stop,
// so it exercises filtering, auto-pause and elevation logic.
//
//   node tools/gen-route.mjs --type run --km 5 > tools/fixtures/run-5k.gpx
//   node tools/gen-route.mjs --type cycle --km 20 --outliers 5 --pause 120 --format json
//
// Options:
//   --type walk|run|cycle   activity profile (default run)
//   --km N                  true route length in km (default 3)
//   --interval S            seconds between fixes (default 1)
//   --noise M               GPS noise std-dev in metres (default 4)
//   --outliers N            number of large position spikes to inject (default 0)
//   --pause S               stop for S seconds at the halfway point (default 0)
//   --climb M               amplitude of rolling elevation profile in metres (default 15)
//   --start LAT,LON         start position (default 52.2133,20.9990 — Pole Mokotowskie, Warsaw)
//   --seed N                PRNG seed (default 42)
//   --format gpx|json       output format (default gpx; json includes ground-truth stats)

import { generateTrack } from './lib/generate.mjs';
import { toGpx } from './lib/geo.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);

const type = args.type ?? 'run';
const km = Number(args.km ?? 3);
const params = {
  interval: Number(args.interval ?? 1),
  noise: Number(args.noise ?? 4),
  outliers: Number(args.outliers ?? 0),
  pauseS: Number(args.pause ?? 0),
  climb: Number(args.climb ?? 15),
};
const [lat, lon] = (args.start ?? '52.2133,20.9990').split(',').map(Number);
let track;
try {
  track = generateTrack({ type, km, ...params, start: { lat, lon }, seed: Number(args.seed ?? 42) });
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

if ((args.format ?? 'gpx') === 'json') {
  process.stdout.write(JSON.stringify({ type, truth: track.truth, params, points: track.points }, null, 2) + '\n');
} else {
  process.stdout.write(toGpx(track.points, { name: `Synthetic ${type} ${km.toFixed(1)} km`, type }));
}
