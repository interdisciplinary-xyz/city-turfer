#!/usr/bin/env node
// Draw the street maps behind the landing-page hero (docs/plans/hero-city-map-2026-10-28.md).
//
// For each city, ask OpenStreetMap (Overpass API) once for the streets and water in a box around the
// centre from the app's Home City catalogue, project, clip and simplify them, and write two colourless
// SVG masks to apps/web/public/city-maps/: <id>-streets.svg and <id>-water.svg. The site colours them
// with brand CSS variables (mask-image), so the files hold no colour. Output is committed: the build
// and the visitor's browser never call OpenStreetMap. Map data © OpenStreetMap contributors (ODbL);
// the hero shows the credit.
//
//   node tools/gen-city-maps.mjs                          # every city in MAP_CITY_IDS
//   node tools/gen-city-maps.mjs pl-gdansk --cache /tmp/osm   # one city; reuse saved Overpass answers

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = path.resolve(HERE, '../../../packages/core/src/contexts/territory/domain/city-catalog.ts');
const OUT_DIR = path.resolve(HERE, '../public/city-maps');
/** Public Overpass instances, tried in turn when one is busy. */
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const USER_AGENT = 'CityTurfer hero map generator (dev tool; https://github.com/interdisciplinary-xyz/city-turfer)';

/** Cities that get a map. Keep in sync with HERO_CITY_IDS in src/app/[locale]/hero-city (a test checks). */
export const MAP_CITY_IDS = [
  'pl-gdansk',
  'pl-warsaw',
  'pl-krakow',
  'pl-wroclaw',
  'pl-poznan',
  'de-berlin',
  'gb-london',
  'cz-prague',
  'lt-vilnius',
];

/** Canvas in px (4:3) and the ground it covers in metres: 4 m per px. */
export const CANVAS = { width: 1600, height: 1200, metresPerPx: 4 };
/** Douglas–Peucker tolerance in px. */
const TOLERANCE_PX = 1;
/** Tighter budget than the test's 80 KB per file, gzipped; dense cities are simplified harder until they fit. */
export const BUDGET_BYTES = 76 * 1024;
/** Steps for a city over budget, in order: drop the smallest street types, then simplify harder. */
const FALLBACK_STEPS = [
  { tolerance: TOLERANCE_PX, skip: ['pedestrian', 'living_street'] },
  { tolerance: TOLERANCE_PX, skip: ['pedestrian', 'living_street', 'unclassified'] },
  { tolerance: 2, skip: ['pedestrian', 'living_street', 'unclassified'] },
];
/** Geometry is clipped to the canvas plus this margin, so strokes don't end visibly at the edge. */
const MARGIN_PX = 20;

/** Street classes → stroke width in px; footways and service roads are left out (size budget). */
export const STREET_CLASSES = [
  { name: 'major', width: 6, highways: ['motorway', 'trunk', 'primary'] },
  { name: 'mid', width: 4, highways: ['secondary', 'tertiary'] },
  { name: 'minor', width: 2.2, highways: ['unclassified', 'residential', 'living_street', 'pedestrian'] },
];
const RIVER_WIDTH = { river: 14, canal: 8 };

/** Catalogue cities from the TypeScript source: `city('pl-warsaw', 'Warsaw', 'PL', lat, lon, r)`. */
export function readCatalog(source) {
  const re = /city\('([a-z]{2}-[a-z-]+)',\s*'([^']+)',\s*'([A-Z]{2})',\s*(-?[\d.]+),\s*(-?[\d.]+),/g;
  const cities = new Map();
  for (const m of source.matchAll(re)) {
    cities.set(m[1], { id: m[1], name: m[2], lat: Number(m[4]), lon: Number(m[5]) });
  }
  return cities;
}

/** Equirectangular projection around the centre; good to well under a pixel over a few kilometres. */
export function projector(center, canvas = CANVAS) {
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * Math.cos((center.lat * Math.PI) / 180);
  return ({ lat, lon }) => [
    canvas.width / 2 + ((lon - center.lon) * mPerDegLon) / canvas.metresPerPx,
    canvas.height / 2 - ((lat - center.lat) * mPerDegLat) / canvas.metresPerPx,
  ];
}

/** [south, west, north, east] in degrees for the canvas plus margin. */
export function bboxOf(center, canvas = CANVAS) {
  const halfW =
    ((canvas.width / 2 + MARGIN_PX) * canvas.metresPerPx) / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  const halfH = ((canvas.height / 2 + MARGIN_PX) * canvas.metresPerPx) / 111_320;
  return [center.lat - halfH, center.lon - halfW, center.lat + halfH, center.lon + halfW];
}

/** Douglas–Peucker on [x, y] points (iterative). */
export function simplify(points, tolerance = TOLERANCE_PX) {
  if (points.length <= 2) {
    return points;
  }
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let max = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const d = len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > max) {
        max = d;
        at = i;
      }
    }
    if (max > tolerance) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const inside = ([x, y], box) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;

/** Split a polyline into the runs that touch the box (a segment is kept if either end is inside). */
export function clipLine(points, box) {
  const runs = [];
  let run = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prevIn = i > 0 && inside(points[i - 1], box);
    const nextIn = i < points.length - 1 && inside(points[i + 1], box);
    if (inside(p, box) || prevIn || nextIn) {
      run.push(p);
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) {
    runs.push(run);
  }
  return runs.filter((r) => r.length >= 2);
}

/** Sutherland–Hodgman: clip a closed ring to the box. */
export function clipRing(ring, box) {
  const edges = [
    [(p) => p[0] >= box.x0, (a, b) => cut(a, b, 0, box.x0)],
    [(p) => p[0] <= box.x1, (a, b) => cut(a, b, 0, box.x1)],
    [(p) => p[1] >= box.y0, (a, b) => cut(a, b, 1, box.y0)],
    [(p) => p[1] <= box.y1, (a, b) => cut(a, b, 1, box.y1)],
  ];
  let out = ring;
  for (const [isIn, cross] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (isIn(cur)) {
        if (!isIn(prev)) {
          out.push(cross(prev, cur));
        }
        out.push(cur);
      } else if (isIn(prev)) {
        out.push(cross(prev, cur));
      }
    }
    if (!out.length) {
      return [];
    }
  }
  return out;
}

function cut(a, b, axis, value) {
  const t = (value - a[axis]) / (b[axis] - a[axis]);
  return axis === 0 ? [value, a[1] + t * (b[1] - a[1])] : [a[0] + t * (b[0] - a[0]), value];
}

/** Join way fragments (lists of {lat, lon}) into closed rings by matching end points. */
export function assembleRings(fragments) {
  const key = (p) => `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`;
  const pool = fragments.filter((f) => f.length >= 2).map((f) => [...f]);
  const rings = [];
  while (pool.length) {
    let ring = pool.shift();
    let grown = true;
    while (key(ring[0]) !== key(ring[ring.length - 1]) && grown) {
      grown = false;
      const end = key(ring[ring.length - 1]);
      for (let i = 0; i < pool.length; i++) {
        const f = pool[i];
        if (key(f[0]) === end) {
          ring = ring.concat(f.slice(1));
        } else if (key(f[f.length - 1]) === end) {
          ring = ring.concat([...f].reverse().slice(1));
        } else {
          continue;
        }
        pool.splice(i, 1);
        grown = true;
        break;
      }
    }
    // Rings left open by the data cut at the query box are closed straight; clipping hides the seam.
    if (ring.length >= 3) {
      rings.push(ring);
    }
  }
  return rings;
}

/** Compact path data: absolute move, then relative lines, rounded to whole pixels. */
export function pathData(points, close = false) {
  const r = points.map(([x, y]) => [Math.round(x), Math.round(y)]);
  const deduped = r.filter((p, i) => i === 0 || p[0] !== r[i - 1][0] || p[1] !== r[i - 1][1]);
  if (deduped.length < 2) {
    return '';
  }
  let d = `M${deduped[0][0]} ${deduped[0][1]}l`;
  for (let i = 1; i < deduped.length; i++) {
    const dx = deduped[i][0] - deduped[i - 1][0];
    const dy = deduped[i][1] - deduped[i - 1][1];
    d += `${i > 1 && dx >= 0 ? ' ' : ''}${dx}${dy >= 0 ? ' ' : ''}${dy}`;
  }
  return close ? `${d}z` : d;
}

function overpassQuery(center) {
  const [s, w, n, e] = bboxOf(center).map((v) => v.toFixed(5));
  const bbox = `(${s},${w},${n},${e})`;
  const highways = STREET_CLASSES.flatMap((c) => c.highways).join('|');
  return `[out:json][timeout:180];(
way["highway"~"^(${highways})$"]${bbox};
way["natural"="water"]${bbox};
way["waterway"="riverbank"]${bbox};
relation["natural"="water"]${bbox};
relation["waterway"="riverbank"]${bbox};
way["waterway"~"^(river|canal)$"]${bbox};
);out geom;`;
}

async function fetchOsm(city, cacheDir) {
  const cached = cacheDir ? path.join(cacheDir, `${city.id}.json`) : null;
  if (cached && existsSync(cached)) {
    return JSON.parse(readFileSync(cached, 'utf8'));
  }
  let json = null;
  for (let attempt = 0; !json; attempt++) {
    const endpoint = OVERPASS[attempt % OVERPASS.length];
    process.stdout.write(`${city.id}: asking ${new URL(endpoint).host}…\n`);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'user-agent': USER_AGENT, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: overpassQuery(city) }),
      signal: AbortSignal.timeout(240_000),
    }).catch((err) => {
      // A hung or dropped connection counts as a busy server.
      process.stdout.write(`${city.id}: ${err.name}, retrying\n`);
      return { ok: false, status: 504 };
    });
    if (res.ok) {
      json = await res.json();
    } else if (attempt >= 5 || ![429, 502, 503, 504].includes(res.status)) {
      throw new Error(`Overpass ${res.status} for ${city.id} (${endpoint})`);
    } else {
      // Busy server: wait longer each time, alternating between the public instances.
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    }
  }
  if (cached) {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(cached, JSON.stringify(json));
  }
  return json;
}

const isWaterArea = (tags = {}) => tags.natural === 'water' || tags.waterway === 'riverbank';

/** Turn an Overpass answer into the two SVG documents. Pure: used by the tests on a fixture. */
export function renderCity(city, osm, canvas = CANVAS, { tolerance = TOLERANCE_PX, skip = [] } = {}) {
  const project = projector(city, canvas);
  const box = { x0: -MARGIN_PX, y0: -MARGIN_PX, x1: canvas.width + MARGIN_PX, y1: canvas.height + MARGIN_PX };
  const streets = new Map(STREET_CLASSES.map((c) => [c.name, []]));
  const rivers = new Map(Object.keys(RIVER_WIDTH).map((k) => [k, []]));
  const waterRings = [];

  const line = (geometry) =>
    clipLine(geometry.filter(Boolean).map(project), box).map((run) => simplify(run, tolerance));
  const ring = (geometry) => {
    const clipped = clipRing(simplify(geometry.map(project), tolerance), box);
    return clipped.length >= 3 ? clipped : null;
  };

  for (const el of osm.elements ?? []) {
    const tags = el.tags ?? {};
    if (el.type === 'way' && el.geometry) {
      const cls = skip.includes(tags.highway) ? null : STREET_CLASSES.find((c) => c.highways.includes(tags.highway));
      if (cls) {
        streets.get(cls.name).push(...line(el.geometry));
      } else if (isWaterArea(tags)) {
        const r = ring(el.geometry);
        if (r) {
          waterRings.push(r);
        }
      } else if (RIVER_WIDTH[tags.waterway]) {
        rivers.get(tags.waterway).push(...line(el.geometry));
      }
    } else if (el.type === 'relation' && isWaterArea(tags)) {
      const fragments = (el.members ?? [])
        .filter((m) => m.type === 'way' && (m.role === 'outer' || m.role === 'inner') && m.geometry)
        .map((m) => m.geometry.filter(Boolean));
      for (const r of assembleRings(fragments)) {
        const clipped = ring(r);
        if (clipped) {
          waterRings.push(clipped);
        }
      }
    }
  }

  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">`;
  const credit = '<!-- Map data © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright -->';
  const strokes = (lines, width) => {
    const d = lines.map((l) => pathData(l)).join('');
    return d
      ? `<path d="${d}" fill="none" stroke="black" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
      : '';
  };

  const streetsSvg = [open, credit, ...STREET_CLASSES.map((c) => strokes(streets.get(c.name), c.width)), '</svg>'].join(
    '\n'
  );
  const waterFill = waterRings.map((r) => pathData(r, true)).join('');
  const waterSvg = [
    open,
    credit,
    waterFill ? `<path d="${waterFill}" fill="black" fill-rule="evenodd"/>` : '',
    ...Object.entries(RIVER_WIDTH).map(([k, w]) => strokes(rivers.get(k), w)),
    '</svg>',
  ].join('\n');
  return { streets: `${streetsSvg}\n`, water: `${waterSvg}\n` };
}

/** Render everything, then fewer street types (FALLBACK_STEPS) until both files fit BUDGET_BYTES gzipped. */
export function renderWithinBudget(city, osm) {
  let out = renderCity(city, osm);
  for (const step of FALLBACK_STEPS) {
    const fits = [out.streets, out.water].every((svg) => gzipSync(svg).byteLength <= BUDGET_BYTES);
    if (fits) {
      return out;
    }
    process.stdout.write(`${city.id}: over budget, leaving out ${step.skip.join(', ')} at ${step.tolerance} px\n`);
    out = renderCity(city, osm, CANVAS, step);
  }
  return out;
}

async function main(argv) {
  const cacheAt = argv.indexOf('--cache');
  const cacheDir = cacheAt >= 0 ? argv[cacheAt + 1] : null;
  const ids = argv.filter((a, i) => !a.startsWith('--') && (cacheAt < 0 || i !== cacheAt + 1));
  const catalog = readCatalog(readFileSync(CATALOG, 'utf8'));
  mkdirSync(OUT_DIR, { recursive: true });
  for (const id of ids.length ? ids : MAP_CITY_IDS) {
    const city = catalog.get(id);
    if (!city) {
      throw new Error(`${id} is not in the Home City catalogue`);
    }
    const osm = await fetchOsm(city, cacheDir);
    const { streets, water } = renderWithinBudget(city, osm);
    writeFileSync(path.join(OUT_DIR, `${id}-streets.svg`), streets);
    writeFileSync(path.join(OUT_DIR, `${id}-water.svg`), water);
    const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(0)} KB`;
    process.stdout.write(`${id}: streets ${kb(streets)}, water ${kb(water)}\n`);
    // Overpass asks for a pause between heavy queries.
    if (!cacheDir || !existsSync(path.join(cacheDir, `${id}.json`))) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  });
}
