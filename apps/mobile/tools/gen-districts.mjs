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
//
// A city is written only when its districts cover MIN_COVERAGE–MAX_COVERAGE of the city's area;
// every district left out (rings that don't close, no name) is reported with its OSM id.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EARTH_RADIUS_M } from './lib/geo.mjs';

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
 * roughly 8–60 districts reads well on a phone. `landKm2`: the official land area (GUS, 2024) where
 * the OSM city boundary takes in the sea, so coverage is measured against land. Kielce and Sopot
 * have no usable district level in OSM (probed 2026-10-29). Toruń and Olsztyn are left out: OSM
 * covers 43 % and 68 % of them (Toruń's Stawki and Rudak don't close; Olsztyn has 17 of its
 * districts), checked 2026-10-30. The other catalogue cities are not probed yet.
 */
export const DISTRICT_CITIES = {
  'pl-warsaw': { city: 8, district: 9 },
  'pl-krakow': { city: 8, district: 9 },
  'pl-lodz': { city: 8, district: 10 },
  'pl-wroclaw': { city: 8, district: 9 },
  'pl-poznan': { city: 8, district: 9 },
  'pl-gdansk': { city: 8, district: 9, landKm2: 261.96 }, // the OSM boundary takes in part of the bay
  'pl-szczecin': { city: 8, district: 10 }, // level 9 is only 4 large districts
  'pl-bydgoszcz': { city: 8, district: 9 },
  'pl-lublin': { city: 8, district: 9 },
  'pl-bialystok': { city: 8, district: 9 },
  'pl-katowice': { city: 8, district: 9 },
  'pl-gdynia': { city: 8, district: 9, landKm2: 135.14 }, // likewise
  'pl-czestochowa': { city: 8, district: 9 },
  'pl-rzeszow': { city: 8, district: 9 },
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
/**
 * Share of the city's area (admin level `city`) the districts must cover. Below it OSM is missing
 * districts (or their ways don't close) and turf there would count in no district; above it the
 * districts overlap (two levels mixed). The generator refuses to write such a city.
 */
/** Longest gap between two loose ends of a district's ways that the generator bridges (metres). */
export const GAP_BRIDGE_M = 50;
/** City boundary level for --probe when a city has no entry yet. */
export const DEFAULT_CITY_LEVEL = 8;
export const MIN_COVERAGE = 0.97;
export const MAX_COVERAGE = 1.03;

// --- geometry (pure, tested) ------------------------------------------------------------------

const key = ([lon, lat]) => `${lon},${lat}`;
const RAD = Math.PI / 180;
/** Metres per degree of latitude on the shared-kernel sphere. */
const M_PER_DEG = EARTH_RADIUS_M * RAD;

/** Great-circle-free distance in metres between two [lon, lat] (local plane; for short gaps only). */
function gapM([x1, y1], [x2, y2]) {
  return Math.hypot((x2 - x1) * M_PER_DEG * Math.cos(((y1 + y2) / 2) * RAD), (y2 - y1) * M_PER_DEG);
}

/**
 * Join OSM ways ([lon, lat][] each) into closed rings. Where no way continues a chain, a dangling
 * end within `bridgeM` of another chain's end (or its own start) is joined to it with a straight
 * line: a way missing from the relation in OSM. Neighbours missing the same way get the same
 * bridge, so their shared border still matches. `bridged` counts those joins, `unclosed` the
 * chains that still never close (left out of `rings`).
 */
export function ringsOf(ways, bridgeM = GAP_BRIDGE_M) {
  const open = ways.filter((w) => w.length >= 2).map((w) => [...w]);
  const rings = [];
  let unclosed = 0;
  let bridged = 0;
  while (open.length > 0) {
    let ring = open.shift();
    while (key(ring[0]) !== key(ring.at(-1))) {
      const end = key(ring.at(-1));
      const i = open.findIndex((w) => key(w[0]) === end || key(w.at(-1)) === end);
      if (i >= 0) {
        const [w] = open.splice(i, 1);
        ring = ring.concat((key(w[0]) === end ? w : [...w].reverse()).slice(1));
        continue;
      }
      // No way continues here: bridge to the nearest loose end within reach, else give up.
      let best = { d: gapM(ring.at(-1), ring[0]), i: -1, flip: false };
      open.forEach((w, j) => {
        for (const flip of [false, true]) {
          const d = gapM(ring.at(-1), flip ? w.at(-1) : w[0]);
          if (d < best.d) {
            best = { d, i: j, flip };
          }
        }
      });
      if (best.d > bridgeM) {
        break;
      }
      bridged++;
      if (best.i < 0) {
        ring = [...ring, ring[0]];
      } else {
        const [w] = open.splice(best.i, 1);
        ring = ring.concat(best.flip ? [...w].reverse() : w);
      }
    }
    if (ring.length >= 4 && key(ring[0]) === key(ring.at(-1))) {
      rings.push(ring);
    } else {
      unclosed++;
    }
  }
  return { rings, unclosed, bridged };
}

/** Closed rings from OSM ways; chains that never close are dropped (see `ringsOf`). */
export function assembleRings(ways) {
  return ringsOf(ways).rings;
}

/**
 * Signed ring area in m² on the shared-kernel sphere (Chamberlain & Duquette, as in
 * packages/core/src/contexts/territory/domain/district.ts): positive when the ring runs
 * counter-clockwise (RFC 7946 outer rings), negative when clockwise.
 */
export function signedRingAreaM2(ring) {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [l1, p1] = ring[i];
    const [l2, p2] = ring[i + 1];
    s += (l2 - l1) * RAD * (2 + Math.sin(p1 * RAD) + Math.sin(p2 * RAD));
  }
  return (-s * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2;
}

/** Ring area in m² on the sphere, always positive. */
export function ringAreaM2(ring) {
  return Math.abs(signedRingAreaM2(ring));
}

/** Polygons ([outer, ...holes][]) area in m²: outer rings minus their holes. */
export function polygonsAreaM2(polygons) {
  return polygons.reduce(
    (a, [outer, ...holes]) => a + ringAreaM2(outer) - holes.reduce((s, h) => s + ringAreaM2(h), 0),
    0
  );
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

/** Inside one of the polygons and not in its holes. */
export function inPolygons(pt, polygons) {
  return polygons.some(([outer, ...holes]) => inRing(pt, outer) && !holes.some((h) => inRing(pt, h)));
}

/**
 * A point strictly inside a polygon ([outer, ...holes]): the middle of the widest stretch inside it
 * along a few scan lines that miss every vertex. Works for concave shapes and holes, unlike the
 * centroid; never a point on the boundary. Null for a ring with no area.
 */
export function interiorPoint(rings) {
  let s = Infinity;
  let n = -Infinity;
  const vertexLats = new Set();
  for (const ring of rings) {
    for (const [, lat] of ring) {
      s = Math.min(s, lat);
      n = Math.max(n, lat);
      vertexLats.add(lat);
    }
  }
  let best = null;
  let widest = 0;
  for (const f of [0.5, 0.25, 0.75, 0.375, 0.625, 0.125, 0.875]) {
    let lat = s + (n - s) * f;
    while (vertexLats.has(lat)) {
      lat += (n - s) * 1e-9;
    }
    const xs = [];
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];
        if (y1 > lat !== y2 > lat) {
          xs.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
        }
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      if (xs[i + 1] - xs[i] > widest) {
        widest = xs[i + 1] - xs[i];
        best = [(xs[i] + xs[i + 1]) / 2, lat];
      }
    }
  }
  return best;
}

/** Douglas–Peucker between kept indices a and b of `xy` (metres), marking `keep`. */
function dpKeep(xy, a0, b0, toleranceM, keep) {
  const stack = [[a0, b0]];
  while (stack.length > 0) {
    const [a, b] = stack.pop();
    let idx = -1;
    let max = toleranceM;
    const [ax, ay] = xy[a];
    const [bx, by] = xy[b];
    const len = Math.hypot(bx - ax, by - ay);
    for (let i = a + 1; i < b; i++) {
      const d =
        len === 0
          ? Math.hypot(xy[i][0] - ax, xy[i][1] - ay)
          : Math.abs((bx - ax) * (ay - xy[i][1]) - (ax - xy[i][0]) * (by - ay)) / len;
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
}

/** [lon, lat] → metres on a local plane around the first point (fine for a tolerance at city scale). */
function toMetres(pts) {
  const mx = M_PER_DEG * Math.cos(pts[0][1] * RAD);
  return pts.map(([lon, lat]) => [lon * mx, lat * M_PER_DEG]);
}

/** Douglas–Peucker on an open line, both ends kept. */
export function simplifyLine(line, toleranceM) {
  if (line.length <= 2) {
    return line;
  }
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  dpKeep(toMetres(line), 0, line.length - 1, toleranceM, keep);
  return line.filter((_, i) => keep[i]);
}

/**
 * Douglas–Peucker on a closed ring, tolerance in metres. Keeps a ring (at least 4 points, a
 * triangle): when the tolerance would leave less, the farthest point from the first chord stays.
 */
export function simplifyRing(ring, toleranceM) {
  if (ring.length <= 4) {
    return ring;
  }
  const xy = toMetres(ring);
  const last = ring.length - 1;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[last] = 1;
  // A closed ring has start = end; split at the point farthest from the start so DP has a chord.
  let far = 1;
  for (let i = 1; i < last; i++) {
    if (
      Math.hypot(xy[i][0] - xy[0][0], xy[i][1] - xy[0][1]) > Math.hypot(xy[far][0] - xy[0][0], xy[far][1] - xy[0][1])
    ) {
      far = i;
    }
  }
  keep[far] = 1;
  dpKeep(xy, 0, far, toleranceM, keep);
  dpKeep(xy, far, last, toleranceM, keep);
  if (keep.reduce((a, b) => a + b, 0) < 4) {
    // Only the start, the far point and the closing point: keep the point farthest from that chord.
    const [ax, ay] = xy[0];
    const [bx, by] = xy[far];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let best = -1;
    let bestD = -1;
    for (let i = 1; i < last; i++) {
      const d = Math.abs((bx - ax) * (ay - xy[i][1]) - (ax - xy[i][0]) * (by - ay)) / len;
      if (i !== far && d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
    }
  }
  return ring.filter((_, i) => keep[i]);
}

const round = (n) => Number(n.toFixed(DECIMALS));

/** Rounded to DECIMALS, with repeated points (two vertices in one rounded spot) removed. */
function roundLine(line) {
  const out = [];
  for (const [x, y] of line) {
    const p = [round(x), round(y)];
    if (out.length === 0 || key(out.at(-1)) !== key(p)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Split every ring at its junctions (a vertex where the boundary branches: not exactly two
 * neighbours, or the rings on the two sides change) into arcs. A border two districts share is the
 * same arc in both, keyed by its first junction and first step in a canonical direction, so it is
 * simplified once and both neighbours get the same vertices.
 */
export function ringArcs(rings) {
  const nbrs = new Map();
  const owners = new Map();
  const edge = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  rings.forEach((ring, r) => {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = key(ring[i]);
      const b = key(ring[i + 1]);
      if (a === b) {
        continue;
      }
      for (const [p, q] of [
        [a, b],
        [b, a],
      ]) {
        if (!nbrs.has(p)) {
          nbrs.set(p, new Set());
        }
        nbrs.get(p).add(q);
      }
      const e = edge(a, b);
      if (!owners.has(e)) {
        owners.set(e, new Set());
      }
      owners.get(e).add(r);
    }
  });
  const ownerKey = (a, b) => [...owners.get(edge(a, b))].sort((x, y) => x - y).join(',');
  const junction = (k) => {
    const n = [...nbrs.get(k)];
    return n.length !== 2 || ownerKey(k, n[0]) !== ownerKey(k, n[1]);
  };
  const arcs = new Map();
  const ringParts = rings.map((raw) => {
    // Repeated points carry no shape; they would only confuse the walk.
    const ring = raw.filter((p, i) => i === 0 || key(p) !== key(raw[i - 1]));
    const open = ring.slice(0, -1);
    let j = open.findIndex((p) => junction(key(p)));
    if (j < 0) {
      // An island: one loop arc, starting at its smallest vertex, in its smaller direction.
      j = open.reduce((m, p, i) => (key(p) < key(open[m]) ? i : m), 0);
      let pts = [...open.slice(j), ...open.slice(0, j)];
      let reversed = false;
      if (pts.length > 1 && key(pts.at(-1)) < key(pts[1])) {
        pts = [pts[0], ...pts.slice(1).reverse()];
        reversed = true;
      }
      pts.push(pts[0]);
      const id = `loop:${key(pts[0])}>${key(pts[1])}`;
      if (!arcs.has(id)) {
        arcs.set(id, { id, pts, loop: true });
      }
      return [{ id, reversed }];
    }
    const walk = [...open.slice(j), ...open.slice(0, j), open[j]];
    const parts = [];
    let start = 0;
    for (let i = 1; i < walk.length; i++) {
      if (i === walk.length - 1 || junction(key(walk[i]))) {
        const pts = walk.slice(start, i + 1);
        const fwd = `${key(pts[0])}>${key(pts[1])}`;
        const rev = `${key(pts.at(-1))}>${key(pts.at(-2))}`;
        const reversed = rev < fwd;
        const id = reversed ? rev : fwd;
        if (!arcs.has(id)) {
          arcs.set(id, { id, pts: reversed ? [...pts].reverse() : pts, loop: false });
        }
        parts.push({ id, reversed });
        start = i;
      }
    }
    return parts;
  });
  return { arcs, ringParts };
}

/** Integer grid of the rounded coordinates, so the crossing tests below are exact. */
const SCALE = 10 ** DECIMALS;
const toInt = ([x, y]) => [Math.round(x * SCALE), Math.round(y * SCALE)];
const orient = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
const same = (p, q) => p[0] === q[0] && p[1] === q[1];
const within = (a, b, p) =>
  Math.min(a[0], b[0]) <= p[0] &&
  p[0] <= Math.max(a[0], b[0]) &&
  Math.min(a[1], b[1]) <= p[1] &&
  p[1] <= Math.max(a[1], b[1]);

/**
 * Do segments ab and cd conflict: cross, touch away from a shared end, or run along each other?
 * Two segments meeting only at a shared end are fine (consecutive edges, junctions).
 */
export function segmentsConflict(a, b, c, d) {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  const shared = [
    [a, b, c, d],
    [a, b, d, c],
    [b, a, c, d],
    [b, a, d, c],
  ].find(([p, , r]) => same(p, r));
  if (shared) {
    const [p, q, , s] = shared;
    if (same(q, s)) {
      return true; // the same segment twice: two borders collapsed onto one line
    }
    // Collinear and pointing the same way from the shared end: they overlap.
    return orient(p, q, s) === 0 && (q[0] - p[0]) * (s[0] - p[0]) + (q[1] - p[1]) * (s[1] - p[1]) > 0;
  }
  if (o1 * o2 < 0 && o3 * o4 < 0) {
    return true;
  }
  return (
    (o1 === 0 && within(a, b, c)) ||
    (o2 === 0 && within(a, b, d)) ||
    (o3 === 0 && within(c, d, a)) ||
    (o4 === 0 && within(c, d, b))
  );
}

/** Ids of the arcs (rounded lines by id) whose segments conflict with another segment. */
export function conflictingArcs(lines) {
  const segs = [];
  for (const [id, line] of lines) {
    const pts = line.map(toInt);
    for (let i = 0; i < pts.length - 1; i++) {
      segs.push({ id, a: pts[i], b: pts[i + 1], i });
    }
  }
  const CELL = 200; // grid buckets of 0.002° (about 200 m)
  const buckets = new Map();
  segs.forEach((s, n) => {
    const [x0, x1] = [Math.min(s.a[0], s.b[0]), Math.max(s.a[0], s.b[0])].map((v) => Math.floor(v / CELL));
    const [y0, y1] = [Math.min(s.a[1], s.b[1]), Math.max(s.a[1], s.b[1])].map((v) => Math.floor(v / CELL));
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const k = `${x},${y}`;
        if (!buckets.has(k)) {
          buckets.set(k, []);
        }
        buckets.get(k).push(n);
      }
    }
  });
  const bad = new Set();
  const checked = new Set();
  for (const list of buckets.values()) {
    for (let p = 0; p < list.length; p++) {
      for (let q = p + 1; q < list.length; q++) {
        const [m, n] = list[p] < list[q] ? [list[p], list[q]] : [list[q], list[p]];
        const pair = m * segs.length + n;
        if (checked.has(pair)) {
          continue;
        }
        checked.add(pair);
        const s = segs[m];
        const t = segs[n];
        if (s.id === t.id && Math.abs(s.i - t.i) === 1 && !same(s.a, t.b) && !same(s.b, t.a)) {
          // Consecutive edges of one line: conflict only if they fold back onto each other.
          const [p0, p1, p2] = s.i < t.i ? [s.a, s.b, t.b] : [t.a, t.b, s.b];
          if (orient(p0, p1, p2) === 0 && (p1[0] - p0[0]) * (p2[0] - p1[0]) + (p1[1] - p0[1]) * (p2[1] - p1[1]) < 0) {
            bad.add(s.id);
          }
          continue;
        }
        if (segmentsConflict(s.a, s.b, t.a, t.b)) {
          bad.add(s.id);
          bad.add(t.id);
        }
      }
    }
  }
  return bad;
}

/**
 * Topology-aware Douglas–Peucker over every ring of a city at once: each arc (see `ringArcs`) is
 * simplified once and rounded to DECIMALS, so neighbours keep one shared border with identical
 * vertices: no gaps, no overlaps along it. An arc whose result crosses or touches another (a
 * self-intersecting ring, two borders collapsed into one) or leaves a ring with no area is redone
 * at half the tolerance, down to keeping every vertex. Returns the rings in input order and the
 * arcs that still conflict (OSM's own geometry; reported, not fixed).
 */
export function simplifyShared(rings, toleranceM) {
  const { arcs, ringParts } = ringArcs(rings);
  const tol = new Map([...arcs.keys()].map((id) => [id, toleranceM]));
  const lineOf = (arc, t) => roundLine(arc.loop ? simplifyRing(arc.pts, t) : simplifyLine(arc.pts, t));
  const lines = new Map([...arcs.values()].map((a) => [a.id, lineOf(a, toleranceM)]));
  const build = (parts) => {
    const ring = [];
    for (const { id, reversed } of parts) {
      const line = reversed ? [...lines.get(id)].reverse() : lines.get(id);
      ring.push(...(ring.length === 0 ? line : line.slice(1)));
    }
    return ring;
  };
  for (let pass = 0; ; pass++) {
    const redo = conflictingArcs(lines);
    ringParts.forEach((parts) => {
      const ring = build(parts);
      if (ring.length < 4 || Math.abs(signedRingAreaM2(ring)) < 1) {
        parts.forEach((p) => redo.add(p.id));
      }
    });
    const refinable = [...redo].filter((id) => tol.get(id) > 0);
    if (refinable.length === 0 || pass > 20) {
      return { rings: ringParts.map(build), conflicts: [...redo] };
    }
    for (const id of refinable) {
      const t = tol.get(id) / 2 < 0.5 ? 0 : tol.get(id) / 2;
      tol.set(id, t);
      lines.set(id, lineOf(arcs.get(id), t));
    }
  }
}

/** Outer rings counter-clockwise, holes clockwise (RFC 7946 §3.1.6). */
export function windPolygon([outer, ...holes]) {
  const wind = (ring, ccw) => (signedRingAreaM2(ring) > 0 === ccw ? ring : [...ring].reverse());
  return [wind(outer, true), ...holes.map((h) => wind(h, false))];
}

/**
 * One OSM relation → polygons ([outer, ...holes][]), largest first. Inner rings go to the outer
 * ring that contains them. `unclosed` counts way chains that never closed, `orphanHoles` inner
 * rings no outer ring holds (both left out), `bridged` the gaps closed by `ringsOf`: the caller
 * reports all three.
 */
export function relationPolygons(rel, bridgeM = GAP_BRIDGE_M) {
  const ways = (role) =>
    rel.members
      .filter((m) => m.type === 'way' && m.geometry && (role === 'inner' ? m.role === 'inner' : m.role !== 'inner'))
      .map((m) => m.geometry.map((p) => [p.lon, p.lat]));
  // Bridge gaps only when that closes every chain: half-bridged scraps are no district.
  const assemble = (role) => {
    const plain = ringsOf(ways(role), 0);
    if (plain.unclosed === 0) {
      return plain;
    }
    const bridged = ringsOf(ways(role), bridgeM);
    return bridged.unclosed === 0 ? bridged : plain;
  };
  const outer = assemble('outer');
  const inner = assemble('inner');
  const polygons = outer.rings.sort((a, b) => ringAreaM2(b) - ringAreaM2(a)).map((o) => [o]);
  let orphanHoles = 0;
  for (const hole of inner.rings) {
    const pt = interiorPoint([hole]);
    // The smallest outer ring holding the hole: an exclave inside a bigger ring takes its own holes.
    const host = pt && polygons.filter((p) => inRing(pt, p[0])).at(-1);
    if (host) {
      host.push(hole);
    } else {
      orphanHoles++;
    }
  }
  return { polygons, unclosed: outer.unclosed + inner.unclosed, bridged: outer.bridged + inner.bridged, orphanHoles };
}

/** Rough middle of a relation's member nodes, for saying where a broken relation lies. */
function memberCentre(rel) {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const m of rel.members) {
    for (const p of m.geometry ?? []) {
      x += p.lon;
      y += p.lat;
      n++;
    }
  }
  return n > 0 ? [x / n, y / n] : null;
}

/**
 * Districts of one city from an Overpass answer: inside the city, simplified together (shared
 * borders stay shared), wound per RFC 7946, sorted by name. Also the city's area (its boundary, or
 * `levels.landKm2` where that takes in the sea), the share of it
 * the districts cover (`coverage`), and what was left out: `dropped` (inside the city but unusable,
 * with the reason) and `warnings` (kept, but with parts missing or borders that still cross).
 */
export function districtsFrom(answer, levels, toleranceM = TOLERANCE_M) {
  const rels = answer.elements.filter((e) => e.type === 'relation' && e.tags?.boundary === 'administrative');
  const cityRel = rels.find((r) => r.tags.admin_level === String(levels.city));
  if (!cityRel) {
    throw new Error(`no admin_level ${levels.city} boundary around the centre`);
  }
  const city = relationPolygons(cityRel).polygons;
  if (city.length === 0) {
    throw new Error(`the admin_level ${levels.city} boundary r${cityRel.id} does not close`);
  }
  const cityAreaM2 = levels.landKm2 ? levels.landKm2 * 1e6 : polygonsAreaM2(city);
  const dropped = [];
  const warnings = [];
  const kept = [];
  const seen = new Set();
  for (const rel of rels) {
    if (rel.tags.admin_level !== String(levels.district) || seen.has(rel.id)) {
      continue;
    }
    seen.add(rel.id);
    const label = `r${rel.id} ${rel.tags.name ?? '(no name)'}`;
    const { polygons, unclosed, bridged, orphanHoles } = relationPolygons(rel);
    const pt = polygons.length > 0 ? interiorPoint(polygons[0]) : memberCentre(rel);
    if (!pt || !inPolygons(pt, city)) {
      continue; // a neighbour sharing the city's border
    }
    if (!rel.tags.name) {
      dropped.push({ id: rel.id, name: '(no name)', reason: 'no name tag' });
      continue;
    }
    if (polygons.length === 0) {
      dropped.push({
        id: rel.id,
        name: rel.tags.name,
        reason: `its ways don't close into a ring (${unclosed} open chains)`,
      });
      continue;
    }
    if (unclosed > 0) {
      warnings.push(`${label}: ${unclosed} way chains don't close; kept the closed rings only`);
    }
    if (bridged > 0) {
      warnings.push(`${label}: ${bridged} gaps of at most ${GAP_BRIDGE_M} m bridged with a straight line`);
    }
    if (orphanHoles > 0) {
      warnings.push(`${label}: ${orphanHoles} inner rings inside no outer ring; left out`);
    }
    kept.push({ rel, polygons });
  }
  const { rings, conflicts } = simplifyShared(
    kept.flatMap((k) => k.polygons.flat()),
    toleranceM
  );
  if (conflicts.length > 0) {
    warnings.push(`${conflicts.length} borders still cross or touch after simplification (OSM's own geometry)`);
  }
  let next = 0;
  const districts = kept.map(({ rel, polygons }) => ({
    id: `osm-r${rel.id}`,
    name: rel.tags.name,
    polygons: polygons.map((p) => windPolygon(p.map(() => rings[next++]))),
  }));
  districts.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  const districtAreaM2 = districts.reduce((a, d) => a + polygonsAreaM2(d.polygons), 0);
  return { districts, cityAreaM2, coverage: districtAreaM2 / cityAreaM2, dropped, warnings };
}

/** Throws when the districts cover too little (or, overlapping, too much) of the city. */
export function checkCoverage({ coverage, dropped }, min = MIN_COVERAGE, max = MAX_COVERAGE) {
  if (coverage < min || coverage > max) {
    const pct = (v) => `${(v * 100).toFixed(1)} %`;
    const why = dropped.map((d) => `r${d.id} ${d.name}: ${d.reason}`).join('; ');
    throw new Error(
      `districts cover ${pct(coverage)} of the city (allowed ${pct(min)}–${pct(max)})` +
        (why ? `; dropped: ${why}` : '')
    );
  }
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

/** The admin level of a city's own boundary: from DISTRICT_CITIES, else 8 (a Polish gmina miejska). */
export function cityLevelOf(cityId) {
  return DISTRICT_CITIES[cityId]?.city ?? DEFAULT_CITY_LEVEL;
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
      const lvl = cityLevelOf(id);
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
      const result = districtsFrom(ans, levels);
      const { districts, cityAreaM2, coverage, dropped, warnings } = result;
      for (const d of dropped) {
        console.warn(`${id}: dropped r${d.id} ${d.name}: ${d.reason}`);
      }
      for (const w of warnings) {
        console.warn(`${id}: ${w}`);
      }
      if (districts.length < MIN_DISTRICTS || districts.length > MAX_DISTRICTS) {
        throw new Error(`${districts.length} districts at level ${levels.district}: wrong level?`);
      }
      checkCoverage(result);
      const body = { cityId: id, adminLevel: levels.district, cityAreaM2: Math.round(cityAreaM2), districts };
      const text = JSON.stringify(body);
      writeFileSync(fileFor(id), `${text}\n`);
      console.log(
        `${id}: ${districts.length} districts, ${(coverage * 100).toFixed(1)} % of the city, ${(text.length / 1024).toFixed(0)} KB`
      );
    } catch (e) {
      console.error(`${id}: ${e.message} (not written; fix OSM or remove the city from DISTRICT_CITIES)`);
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
