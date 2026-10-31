// Node check of the district generator's geometry (tools/gen-districts.mjs) on small hand-made
// Overpass answers: no network.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assembleRings,
  checkCoverage,
  cityLevelOf,
  DEFAULT_CITY_LEVEL,
  districtsFrom,
  indexSource,
  inPolygons,
  inRing,
  interiorPoint,
  MAX_COVERAGE,
  MIN_COVERAGE,
  ringAreaM2,
  ringsOf,
  signedRingAreaM2,
  simplifyRing,
  simplifyShared,
} from '../gen-districts.mjs';
import { EARTH_RADIUS_M } from '../lib/geo.mjs';

const square = (x, y, d) => [
  [x, y],
  [x + d, y],
  [x + d, y + d],
  [x, y + d],
  [x, y],
];
const geom = (pts) => pts.map(([lon, lat]) => ({ lon, lat }));
const way = (pts, role = 'outer') => ({ type: 'way', role, geometry: geom(pts) });
const rel = (id, level, name, members) => ({
  type: 'relation',
  id,
  tags: { boundary: 'administrative', admin_level: String(level), name },
  members,
});
const key = ([x, y]) => `${x},${y}`;

test('assembleRings joins split and reversed ways into one closed ring', () => {
  const [a, b, c, d, e] = square(18.6, 54.3, 0.01);
  const rings = assembleRings([
    [a, b],
    [d, c, b], // reversed
    [d, e],
  ]);
  assert.equal(rings.length, 1);
  assert.deepEqual(rings[0][0], rings[0].at(-1));
  assert.equal(rings[0].length, 5);
});

test('ringsOf reports a chain that never closes instead of dropping it silently', () => {
  const r = ringsOf(
    [
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    ],
    0
  );
  assert.deepEqual(r.rings, []);
  assert.equal(r.unclosed, 1);
});

test('ringsOf bridges a gap of a few metres, but not one of hundreds', () => {
  const [a, b, c, d] = square(18.6, 54.3, 0.01);
  const near = [a[0], a[1] + 0.0002]; // stops about 22 m short of where it started
  const far = [a[0], a[1] + 0.005]; // about 550 m short
  const bridged = ringsOf([[a, b, c, d, near]], 50);
  assert.equal(bridged.rings.length, 1);
  assert.equal(bridged.bridged, 1);
  assert.equal(ringsOf([[a, b, c, d, far]], 50).unclosed, 1);
});

test('districtsFrom reports a district whose ways do not close, with its id and the reason', () => {
  const answer = {
    elements: [
      rel(1, 8, 'Miasto', [way(square(18.6, 54.3, 0.1))]),
      rel(2, 9, 'Zaspa', [way(square(18.6, 54.3, 0.05))]),
      // Two sides of a square: OSM is missing the rest of the boundary.
      rel(3, 9, 'Stawki', [
        way([
          [18.65, 54.3],
          [18.7, 54.3],
          [18.7, 54.35],
        ]),
      ]),
    ],
  };
  const out = districtsFrom(answer, { city: 8, district: 9 });
  assert.deepEqual(
    out.districts.map((d) => d.name),
    ['Zaspa']
  );
  assert.equal(out.dropped.length, 1);
  assert.equal(out.dropped[0].id, 3);
  assert.equal(out.dropped[0].name, 'Stawki');
  assert.match(out.dropped[0].reason, /don't close/);
  assert.ok(out.coverage > 0.24 && out.coverage < 0.26, `a quarter of the city: ${out.coverage}`);
});

test('checkCoverage refuses a city its districts cover too little or too much of', () => {
  assert.equal(MIN_COVERAGE, 0.97);
  const r = (coverage) => ({ coverage, dropped: [{ id: 4190186, name: 'Stawki', reason: "its ways don't close" }] });
  assert.throws(() => checkCoverage(r(0.426)), /cover 42\.6 %.*r4190186 Stawki/);
  assert.throws(() => checkCoverage(r(MAX_COVERAGE + 0.01)), /cover 104\.0 %/);
  assert.doesNotThrow(() => checkCoverage(r(0.998)));
});

test('districtsFrom measures coverage against land where the boundary takes in the sea', () => {
  const answer = {
    elements: [
      rel(1, 8, 'Miasto', [way(square(18.6, 54.3, 0.1))]),
      rel(2, 9, 'Zaspa', [way(square(18.6, 54.3, 0.05))]),
    ],
  };
  const land = ringAreaM2(square(18.6, 54.3, 0.05)) / 1e6;
  const out = districtsFrom(answer, { city: 8, district: 9, landKm2: land });
  assert.equal(out.cityAreaM2, land * 1e6);
  assert.ok(Math.abs(out.coverage - 1) < 1e-9);
});

test('simplifyRing never leaves a ring with fewer than 4 points, whatever the tolerance', () => {
  // A long thin ring: at 1 km tolerance plain Douglas–Peucker keeps only its two far ends.
  const thin = [
    [18.6, 54.3],
    [18.61, 54.3001],
    [18.62, 54.3],
    [18.63, 54.3001],
    [18.63, 54.3002],
    [18.62, 54.3003],
    [18.61, 54.3002],
    [18.6, 54.3003],
    [18.6, 54.3],
  ];
  const out = simplifyRing(thin, 1000);
  assert.ok(out.length >= 4, `kept ${out.length} points`);
  assert.deepEqual(out[0], out.at(-1));
  assert.ok(ringAreaM2(out) > 0);
});

test('simplifyRing keeps a closed ring and drops points within the tolerance', () => {
  const ring = square(18.6, 54.3, 0.01);
  // A point 1 m off the bottom edge, which a 12 m tolerance removes.
  const noisy = [ring[0], [18.605, 54.30001], ...ring.slice(1)];
  const out = simplifyRing(noisy, 12);
  assert.deepEqual(out, ring);
  assert.ok(Math.abs(ringAreaM2(out) - ringAreaM2(ring)) < 1);
});

test('measures area on the shared-kernel sphere, signed by winding', () => {
  const rad = Math.PI / 180;
  const exact = EARTH_RADIUS_M ** 2 * 0.01 * rad * Math.sin(0.01 * rad);
  assert.ok(Math.abs(ringAreaM2(square(0, 0, 0.01)) - exact) < 10);
  assert.ok(signedRingAreaM2(square(0, 0, 0.01)) > 0, 'counter-clockwise is positive');
  assert.ok(signedRingAreaM2([...square(0, 0, 0.01)].reverse()) < 0);
});

test('interiorPoint is strictly inside a concave ring, where the vertex average is outside', () => {
  const u = [
    [0, 0],
    [0.03, 0],
    [0.03, 0.03],
    [0.02, 0.03],
    [0.02, 0.01],
    [0.01, 0.01],
    [0.01, 0.03],
    [0, 0.03],
    [0, 0],
  ];
  const avg = u.slice(0, -1).reduce(([x, y], [a, b]) => [x + a / 8, y + b / 8], [0, 0]);
  assert.equal(inRing(avg, u), false, 'the old centroid probe falls outside');
  const p = interiorPoint([u]);
  for (const [dx, dy] of [
    [0, 0],
    [1e-6, 0],
    [-1e-6, 0],
    [0, 1e-6],
    [0, -1e-6],
  ]) {
    assert.ok(inRing([p[0] + dx, p[1] + dy], u), 'inside, and not on the boundary');
  }
  assert.equal(
    interiorPoint([
      [
        [0, 0],
        [1, 1],
        [0, 0],
      ],
    ]),
    null
  );
});

test('districtsFrom keeps a concave district on the city edge that the centroid would have lost', () => {
  // The city is the U's bounding square; the U's vertex average lies in the notch, outside the city.
  const cityRing = [
    [0, 0],
    [0.03, 0],
    [0.03, 0.03],
    [0.02, 0.03],
    [0.02, 0.01],
    [0.01, 0.01],
    [0.01, 0.03],
    [0, 0.03],
    [0, 0],
  ];
  const out = districtsFrom(
    { elements: [rel(1, 8, 'Miasto', [way(cityRing)]), rel(2, 9, 'Podkowa', [way(cityRing)])] },
    { city: 8, district: 9 }
  );
  assert.deepEqual(
    out.districts.map((d) => d.name),
    ['Podkowa']
  );
});

test('districtsFrom keeps districts inside the city, attaches holes, drops neighbours, sorts by name', () => {
  const answer = {
    elements: [
      rel(1, 8, 'Miasto', [way(square(18.6, 54.3, 0.1))]),
      rel(2, 9, 'Zaspa', [way(square(18.6, 54.3, 0.05))]),
      rel(3, 9, 'Brzeźno', [way(square(18.65, 54.3, 0.05)), way(square(18.66, 54.31, 0.01), 'inner')]),
      rel(4, 9, 'Sąsiad', [way(square(18.7, 54.3, 0.05))]), // east of the city: shares its border
      rel(5, 9, undefined, [way(square(18.6, 54.35, 0.05))]), // no name
    ],
  };
  const out = districtsFrom(answer, { city: 8, district: 9 });
  assert.deepEqual(
    out.districts.map((d) => d.name),
    ['Brzeźno', 'Zaspa']
  );
  assert.equal(out.districts[0].id, 'osm-r3');
  assert.equal(out.districts[0].polygons[0].length, 2, 'outer ring and its hole');
  assert.ok(inRing([18.665, 54.315], out.districts[0].polygons[0][1]), 'the hole is where OSM put it');
  assert.deepEqual(
    out.dropped.map((d) => [d.id, d.reason]),
    [[5, 'no name tag']]
  );
});

test('districtsFrom winds outer rings counter-clockwise and holes clockwise (RFC 7946)', () => {
  const cw = (ring) => [...ring].reverse();
  const answer = {
    elements: [
      rel(1, 8, 'Miasto', [way(square(18.6, 54.3, 0.1))]),
      rel(2, 9, 'Oliwa', [way(cw(square(18.6, 54.3, 0.05))), way(square(18.61, 54.31, 0.01), 'inner')]),
    ],
  };
  const [outer, hole] = districtsFrom(answer, { city: 8, district: 9 }).districts[0].polygons[0];
  assert.ok(signedRingAreaM2(outer) > 0);
  assert.ok(signedRingAreaM2(hole) < 0);
});

test('neighbours keep identical vertices along their shared border after simplification', () => {
  // A wiggly border (a few metres of noise every 50 m) between two districts, each ring in its own
  // direction and starting at a different point, as OSM hands them over.
  const border = Array.from({ length: 41 }, (_, i) => [18.62 + (i % 2) * 0.00004 * (i % 3), 54.3 + i * 0.00045]);
  const top = border.at(-1);
  const bottom = border[0];
  const west = [bottom, ...border.slice(1), [18.6, top[1]], [18.6, 54.3], bottom];
  const east = [[18.64, 54.3], [18.64, top[1]], ...[...border].reverse(), [18.64, 54.3]];
  const { rings, conflicts } = simplifyShared([west, east], 20);
  assert.deepEqual(conflicts, []);
  const onBorder = (ring) => ring.filter(([x]) => x > 18.61 && x < 18.63).map(key);
  assert.deepEqual(new Set(onBorder(rings[0])), new Set(onBorder(rings[1])));
  assert.ok(onBorder(rings[0]).length < border.length, 'and the border was simplified');
});

test('simplifyShared redoes a border that would collapse onto its neighbour', () => {
  // A thin lens between two borders that share both ends: at 50 m both flatten onto one line.
  const a = [18.6, 54.3];
  const b = [18.62, 54.3];
  const north = [a, [18.605, 54.3002], [18.61, 54.3003], [18.615, 54.3002], b];
  const south = [a, [18.605, 54.3001], [18.61, 54.30015], [18.615, 54.3001], b];
  const lens = [...north, ...[...south].reverse().slice(1)];
  // Each neighbour takes its side of the lens.
  const above = [...north, [18.62, 54.31], [18.6, 54.31], a];
  const below = [...south, [18.62, 54.29], [18.6, 54.29], a];
  const { rings, conflicts } = simplifyShared([lens, above, below], 50);
  assert.deepEqual(conflicts, []);
  assert.ok(rings[0].length >= 4);
  assert.ok(ringAreaM2(rings[0]) > 0.5 * ringAreaM2(lens), 'the lens keeps its area');
});

test('districtsFrom fails loudly without the city boundary', () => {
  assert.throws(() => districtsFrom({ elements: [] }, { city: 8, district: 9 }), /no admin_level 8/);
});

test('districtsFrom takes the city at its configured level, not another admin boundary around it', () => {
  const answer = {
    elements: [
      rel(1, 4, 'Land', [way(square(18, 54, 2))]),
      rel(2, 8, 'Miasto', [way(square(18.6, 54.3, 0.1))]),
      rel(3, 9, 'Zaspa', [way(square(18.6, 54.3, 0.1))]),
    ],
  };
  assert.ok(Math.abs(districtsFrom(answer, { city: 8, district: 9 }).coverage - 1) < 1e-9);
  assert.ok(districtsFrom(answer, { city: 4, district: 9 }).coverage < 0.01);
});

test('cityLevelOf falls back to a Polish city boundary (level 8) for a city not configured yet', () => {
  assert.equal(DEFAULT_CITY_LEVEL, 8);
  assert.equal(cityLevelOf('pl-radom'), 8);
  assert.equal(cityLevelOf('de-berlin'), 4);
});

test('inPolygons honours holes', () => {
  const p = [[square(0, 0, 1), square(0.25, 0.25, 0.5)]];
  assert.ok(inPolygons([0.1, 0.1], p));
  assert.ok(!inPolygons([0.5, 0.5], p));
});

test('indexSource has a lazy loader per city, sorted', () => {
  const src = indexSource(['pl-gdansk', 'de-berlin']);
  assert.match(src, /'de-berlin': \(\) => require\('\.\/de-berlin\.json'\) as DistrictFile,\n {2}'pl-gdansk'/);
  assert.doesNotMatch(src, /^import .*\.json/m);
});
