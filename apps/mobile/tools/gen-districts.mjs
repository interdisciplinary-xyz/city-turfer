#!/usr/bin/env node
// Build the district boundaries behind the Districts screen (dev only; docs/plans/districts-2026-10-29.md).
//
// For each city in DISTRICT_CITIES, ask OpenStreetMap (Overpass API) once for the city's boundary and
// its administrative districts, assemble the rings, keep the districts inside the city, simplify them
// and write packages/core/src/districts/data/<city-id>.json plus the generated index.ts. The output is
// committed: the app and the build never call OpenStreetMap. Map data © OpenStreetMap contributors
// (ODbL); the Districts screen shows the credit.
//
//   node tools/gen-districts.mjs                         # every city in DISTRICT_CITIES
//   node tools/gen-districts.mjs pl-gdansk --cache /tmp/osm   # one city; reuse saved Overpass answers
//   node tools/gen-districts.mjs --probe pl-lodz         # district counts per admin level (no write)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = path.resolve(HERE, '../../../packages/core/src/contexts/territory/domain/city-catalog.ts');
export const OUT_DIR = path.resolve(HERE, '../../../packages/core/src/districts/data');
/** Public Overpass instances, tried in turn when one is busy. */
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const USER_AGENT = 'CityTurfer district generator (dev tool; https://github.com/interdisciplinary-xyz/city-turfer)';

/**
 * Cities with districts and the OSM admin levels to use: `city` is the boundary that contains the
 * catalogue centre, `district` the level split into districts. Chosen by --probe: a level with
 * roughly 8–60 districts reads well on a phone. Kielce and Sopot have no usable district level in OSM
 * (probed 2026-10-29); the other catalogue cities are not probed yet.
 */
export const DISTRICT_CITIES = {
  'pl-warsaw': { city: 8, district: 9 },
  'pl-krakow': { city: 8, district: 9 },
  'pl-lodz': { city: 8, district: 10 },
  'pl-wroclaw': { city: 8, district: 9 },
  'pl-poznan': { city: 8, district: 9 },
  'pl-gdansk': { city: 8, district: 9 },
  'pl-szczecin': { city: 8, district: 10 }, // level 9 is only 4 large districts
  'pl-bydgoszcz': { city: 8, district: 9 },
  'pl-lublin': { city: 8, district: 9 },
  'pl-bialystok': { city: 8, district: 9 },
  'pl-katowice': { city: 8, district: 9 },
  'pl-gdynia': { city: 8, district: 9 },
  'pl-czestochowa': { city: 8, district: 9 },
  'pl-rzeszow': { city: 8, district: 9 },
  'pl-torun': { city: 8, district: 9 },
  'pl-olsztyn': { city: 8, district: 9 },
  'pl-opole': { city: 8, district: 9 },
  'de-berlin': { city: 4, district: 9 },
};

/** Douglas–Peucker tolerance in metres: boundaries stay true to the street at screen scale. */
export const TOLERANCE_M = 20;
/** Coordinates kept to 5 decimals (about 1 m). */
const DECIMALS = 5;
/** Sane district counts: outside this the level is wrong for the city (run --probe). */
export const MIN_DISTRICTS = 3;
export const MAX_DISTRICTS = 120;

// --- geometry (pure, tested) ------------------------------------------------------------------

const key = ([lon, lat]) => `${lon},${lat}`;

/**
 * Join OSM ways ([lon, lat][] each) into closed rings. Ways that never close (broken data at the
 * edge of an extract) are dropped.
 */
export function assembleRings(ways) {
  const open = ways.filter((w) => w.length >= 2).map((w) => [...w]);
  const rings = [];
  while (open.length > 0) {
    let ring = open.shift();
    while (key(ring[0]) !== key(ring.at(-1))) {
      const end = key(ring.at(-1));
      const i = open.findIndex((w) => key(w[0]) === end || key(w.at(-1)) === end);
      if (i < 0) {
        break;
      }
      const [w] = open.splice(i, 1);
      ring = ring.concat((key(w[0]) === end ? w : [...w].reverse()).slice(1));
    }
    if (ring.length >= 4 && key(ring[0]) === key(ring.at(-1))) {
      rings.push(ring);
    }
  }
  return rings;
}

/** Ring area in m² (equirectangular around the ring; fine at city scale), always positive. */
export function ringAreaM2(ring) {
  const lat0 = (ring[0][1] * Math.PI) / 180;
  const mx = 111_320 * Math.cos(lat0);
  const my = 110_540;
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    s += ring[i][0] * mx * (ring[i + 1][1] * my) - ring[i + 1][0] * mx * (ring[i][1] * my);
  }
  return Math.abs(s) / 2;
}

/** Ray casting; `ring` closed, [lon, lat]. */
export function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Douglas–Peucker on a closed ring, tolerance in metres. Keeps at least 4 points (a triangle). */
export function simplifyRing(ring, toleranceM) {
  const lat0 = (ring[0][1] * Math.PI) / 180;
  const mx = 111_320 * Math.cos(lat0);
  const my = 110_540;
  const pts = ring.map(([lon, lat]) => [lon * mx, lat * my]);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  // A closed ring has start = end; split at the point farthest from the start so DP has a chord.
  let far = 0;
  let farD = -1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  keep[far] = 1;
  const stack = [
    [0, far],
    [far, pts.length - 1],
  ];
  while (stack.length > 0) {
    const [a, b] = stack.pop();
    let idx = -1;
    let max = toleranceM;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (idx >= 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out = ring.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : ring;
}

const round = (n) => Number(n.toFixed(DECIMALS));

/** A point inside the ring's area, for "is this district in the city?": the centroid, else a vertex nudge. */
export function samplePoint(ring) {
  let x = 0;
  let y = 0;
  for (const [lon, lat] of ring.slice(0, -1)) {
    x += lon;
    y += lat;
  }
  const c = [x / (ring.length - 1), y / (ring.length - 1)];
  return inRing(c, ring) ? c : ring[0];
}

/**
 * One OSM relation → polygons ([outer, ...holes][]), largest first. Inner rings go to the outer ring
 * that contains them.
 */
export function relationPolygons(rel) {
  const ways = (role) =>
    rel.members
      .filter((m) => m.type === 'way' && m.geometry && (role === 'inner' ? m.role === 'inner' : m.role !== 'inner'))
      .map((m) => m.geometry.map((p) => [p.lon, p.lat]));
  const outers = assembleRings(ways('outer')).sort((a, b) => ringAreaM2(b) - ringAreaM2(a));
  const polygons = outers.map((o) => [o]);
  for (const inner of assembleRings(ways('inner'))) {
    const host = polygons.find((p) => inRing(samplePoint(inner), p[0]));
    host?.push(inner);
  }
  return polygons;
}

/** Districts of one city from an Overpass answer: inside the city, simplified, rounded, sorted by name. */
export function districtsFrom(answer, levels, toleranceM = TOLERANCE_M) {
  const rels = answer.elements.filter((e) => e.type === 'relation' && e.tags?.boundary === 'administrative');
  const cityRel = rels.find((r) => r.tags.admin_level === String(levels.city));
  if (!cityRel) {
    throw new Error(`no admin_level ${levels.city} boundary around the centre`);
  }
  const cityRings = relationPolygons(cityRel).map((p) => p[0]);
  const inCity = (pt) => cityRings.some((r) => inRing(pt, r));
  const districts = [];
  const seen = new Set();
  for (const rel of rels) {
    if (rel.tags.admin_level !== String(levels.district) || !rel.tags.name || seen.has(rel.id)) {
      continue;
    }
    const polygons = relationPolygons(rel);
    if (polygons.length === 0 || !inCity(samplePoint(polygons[0][0]))) {
      continue; // a neighbour sharing the city's border
    }
    seen.add(rel.id);
    districts.push({
      id: `osm-r${rel.id}`,
      name: rel.tags.name,
      polygons: polygons.map((p) =>
        p.map((ring) => simplifyRing(ring, toleranceM).map(([x, y]) => [round(x), round(y)]))
      ),
    });
  }
  return districts.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

// --- I/O ---------------------------------------------------------------------------------------

/** Catalogue cities by id, read from the source file (the tool runs without a TS loader). */
export function readCatalog(file = CATALOG) {
  const src = readFileSync(file, 'utf8');
  const out = {};
  for (const m of src.matchAll(/city\('([^']+)', '([^']+)', '([A-Z]{2})', (-?[\d.]+), (-?[\d.]+), /g)) {
    out[m[1]] = { id: m[1], name: m[2], lat: Number(m[4]), lon: Number(m[5]) };
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(query, cacheFile) {
  if (cacheFile && existsSync(cacheFile)) {
    return JSON.parse(readFileSync(cacheFile, 'utf8'));
  }
  let last;
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = OVERPASS[attempt % OVERPASS.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(240_000),
      });
      const text = await res.text();
      if (res.ok && text.startsWith('{')) {
        const json = JSON.parse(text);
        if (cacheFile) {
          writeFileSync(cacheFile, text);
        }
        return json;
      }
      last = new Error(`${url}: HTTP ${res.status} ${text.slice(0, 80).replace(/\s+/g, ' ')}`);
    } catch (e) {
      last = e;
    }
    await sleep(5_000 * (attempt + 1));
  }
  throw last;
}

/** The city boundary (admin `city`) containing the centre and every `levels` relation inside it. */
export function cityQuery(c, levels) {
  return `[out:json][timeout:200];
is_in(${c.lat},${c.lon})->.all;
area.all[boundary=administrative][admin_level=${levels.city}]->.city;
rel(pivot.city)->.cr;
rel(area.city)[boundary=administrative][admin_level~"^(${levels.district})$"]->.d;
(.cr;.d;);
out geom;`;
}

function probeQuery(c, cityLevel) {
  return `[out:json][timeout:200];
is_in(${c.lat},${c.lon})->.all;
area.all[boundary=administrative][admin_level=${cityLevel}]->.city;
rel(area.city)[boundary=administrative][admin_level~"^(9|10|11)$"];
out tags;`;
}

export function fileFor(cityId) {
  return path.join(OUT_DIR, `${cityId}.json`);
}

/**
 * index.ts: a loader per generated city. `require` inside a function keeps each JSON module unloaded
 * until that city's districts are first read (Metro evaluates modules on first require), so app start
 * and the headless location task never pay for the boundaries.
 */
export function indexSource(cityIds) {
  const ids = [...cityIds].sort();
  return [
    '// Generated by apps/mobile/tools/gen-districts.mjs: do not edit. Map data © OpenStreetMap contributors (ODbL).',
    '/* eslint-disable @typescript-eslint/no-require-imports -- lazy per-city loading */',
    "import type { DistrictFile } from '../district-file';",
    '',
    'export const DISTRICT_FILES: Readonly<Record<string, () => DistrictFile>> = {',
    ...ids.map((id) => `  '${id}': () => require('./${id}.json') as DistrictFile,`),
    '};',
    '',
  ].join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const cacheAt = args.indexOf('--cache');
  const cacheDir = cacheAt >= 0 ? args[cacheAt + 1] : null;
  const probe = args.includes('--probe');
  const ids = args.filter((a, i) => !a.startsWith('--') && (cacheAt < 0 || i !== cacheAt + 1));
  const catalog = readCatalog();
  const targets = ids.length > 0 ? ids : Object.keys(DISTRICT_CITIES);
  if (cacheDir) {
    mkdirSync(cacheDir, { recursive: true });
  }
  mkdirSync(OUT_DIR, { recursive: true });
  for (const id of targets) {
    const c = catalog[id];
    if (!c) {
      console.error(`${id}: not in the city catalogue`);
      process.exitCode = 1;
      continue;
    }
    if (probe) {
      const lvl = DISTRICT_CITIES[id]?.city ?? 8;
      const ans = await overpass(probeQuery(c, lvl), cacheDir && path.join(cacheDir, `${id}-probe.json`));
      const by = {};
      for (const e of ans.elements) {
        (by[e.tags.admin_level] ??= []).push(e.tags.name);
      }
      console.log(
        `${id}: ` +
          (Object.entries(by)
            .map(([l, n]) => `level ${l}: ${n.length} (${n.slice(0, 3).join(', ')})`)
            .join('; ') || 'none')
      );
      continue;
    }
    const levels = DISTRICT_CITIES[id];
    if (!levels) {
      console.error(`${id}: no levels in DISTRICT_CITIES (run --probe first)`);
      process.exitCode = 1;
      continue;
    }
    try {
      const ans = await overpass(cityQuery(c, levels), cacheDir && path.join(cacheDir, `${id}.json`));
      const districts = districtsFrom(ans, levels);
      if (districts.length < MIN_DISTRICTS || districts.length > MAX_DISTRICTS) {
        throw new Error(`${districts.length} districts at level ${levels.district}: wrong level?`);
      }
      const body = { cityId: id, adminLevel: levels.district, districts };
      const text = JSON.stringify(body);
      writeFileSync(fileFor(id), `${text}\n`);
      console.log(`${id}: ${districts.length} districts, ${(text.length / 1024).toFixed(0)} KB`);
    } catch (e) {
      console.error(`${id}: ${e.message}`);
      process.exitCode = 1;
    }
  }
  if (!probe) {
    const { readdirSync } = await import('node:fs');
    const have = readdirSync(OUT_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
    writeFileSync(path.join(OUT_DIR, 'index.ts'), indexSource(have));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
