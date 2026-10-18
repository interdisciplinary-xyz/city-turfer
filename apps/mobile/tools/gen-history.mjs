#!/usr/bin/env node
// Generate months of synthetic activity history around a home location, with
// favourite routes repeated many times (each with fresh GPS noise) plus
// occasional one-off explorations. This is the fixture for turf/territory work:
// overlapping tracks, glow intensity, fading over time, viewport performance.
//
//   node tools/gen-history.mjs --days 120 --out tools/fixtures/history
//   node tools/gen-history.mjs --days 365 --per-week 5 --interval 3 --out /tmp/year
//
// Options:
//   --days N          length of history ending at --end (default 90)
//   --end YYYY-MM-DD  last day (default today)
//   --per-week N      average activities per week (default 4)
//   --routes N        number of favourite routes (default 6)
//   --explore P       probability an activity is a new one-off route (default 0.15)
//   --home LAT,LON    start of every activity (default 52.2133,20.9990)
//   --interval S      seconds between fixes (default 2; keeps files small)
//   --seed N          PRNG seed (default 7)
//   --out DIR         output directory (default tools/fixtures/history)
//
// Writes one GPX per activity plus manifest.json. Output is deterministic, so
// it does not need to be committed — regenerate it instead.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateTrack } from './lib/generate.mjs';
import { mulberry32, toGpx } from './lib/geo.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);
const days = Number(args.days ?? 90);
const end = args.end ? Date.parse(`${args.end}T00:00:00Z`) : Date.parse(new Date().toISOString().slice(0, 10));
const perWeek = Number(args['per-week'] ?? 4);
const nRoutes = Number(args.routes ?? 6);
const explore = Number(args.explore ?? 0.15);
const [lat, lon] = (args.home ?? '52.2133,20.9990').split(',').map(Number);
const interval = Number(args.interval ?? 2);
const rand = mulberry32(Number(args.seed ?? 7));
const out = args.out ?? fileURLToPath(new URL('fixtures/history', import.meta.url));

const TYPES = [
  { type: 'walk', km: [1.5, 4] },
  { type: 'run', km: [4, 10] },
  { type: 'cycle', km: [12, 35] },
];
const pickKm = ([a, b]) => Math.round((a + rand() * (b - a)) * 10) / 10;
const makeRoute = (i) => {
  const spec = TYPES[i % TYPES.length];
  return { id: `route-${i}`, type: spec.type, km: pickKm(spec.km), seed: 1000 + Math.floor(rand() * 1e6) };
};

const favourites = Array.from({ length: nRoutes }, (_, i) => makeRoute(i));
// Zipf-ish preference: route 0 is the daily loop, later ones are rarer.
const weights = favourites.map((_, i) => 1 / (i + 1));
const totalW = weights.reduce((s, w) => s + w, 0);
const pickFavourite = () => {
  let r = rand() * totalW;
  for (let i = 0; i < favourites.length; i++) {
    if ((r -= weights[i]) <= 0) {
      return favourites[i];
    }
  }
  return favourites[0];
};

mkdirSync(out, { recursive: true });
const manifest = { home: { lat, lon }, generatedFor: { days, perWeek, nRoutes, explore }, activities: [] };
let explorations = 0;

for (let d = days - 1; d >= 0; d--) {
  const day = end - d * 86400000;
  if (rand() > perWeek / 7) {
    continue;
  }
  const isNew = rand() < explore;
  const route = isNew ? { ...makeRoute(Math.floor(rand() * 3)), id: `explore-${explorations++}` } : pickFavourite();
  const startTime = day + (6 + Math.floor(rand() * 13)) * 3600000 + Math.floor(rand() * 60) * 60000;
  const { points, truth } = generateTrack({
    type: route.type,
    km: route.km,
    interval,
    start: { lat, lon },
    seed: route.seed,
    noiseSeed: Math.floor(rand() * 1e9),
    startTime,
  });
  const date = new Date(startTime).toISOString().slice(0, 10);
  const file = `${date}-${route.type}-${route.id}.gpx`;
  writeFileSync(
    join(out, file),
    toGpx(points, { name: `${route.type} ${route.km} km (${route.id})`, type: route.type })
  );
  manifest.activities.push({ file, date, type: route.type, routeId: route.id, km: route.km, startTime, truth });
}

writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
const byType = manifest.activities.reduce((m, a) => ((m[a.type] = (m[a.type] ?? 0) + 1), m), {});
console.log(
  `Wrote ${manifest.activities.length} activities to ${out}/ (${JSON.stringify(byType)}, ${explorations} explorations)`
);
