// Node check of the district generator's geometry (tools/gen-districts.mjs) on small hand-made
// Overpass answers: no network.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assembleRings, districtsFrom, indexSource, inRing, ringAreaM2, simplifyRing } from '../gen-districts.mjs';

const square = (x, y, d) => [
  [x, y],
  [x + d, y],
  [x + d, y + d],
  [x, y + d],
  [x, y],
];
const way = (pts) => ({ type: 'way', role: 'outer', geometry: pts.map(([lon, lat]) => ({ lon, lat })) });
const rel = (id, level, name, members) => ({
  type: 'relation',
  id,
  tags: { boundary: 'administrative', admin_level: String(level), name },
  members,
});

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

test('assembleRings drops a ring that never closes', () => {
  assert.deepEqual(
    assembleRings([
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    ]),
    []
  );
});

test('simplifyRing keeps a closed ring and drops points within the tolerance', () => {
  const ring = square(18.6, 54.3, 0.01);
  // A point 1 m off the bottom edge, which a 12 m tolerance removes.
  const noisy = [ring[0], [18.605, 54.30001], ...ring.slice(1)];
  const out = simplifyRing(noisy, 12);
  assert.deepEqual(out, ring);
  assert.ok(Math.abs(ringAreaM2(out) - ringAreaM2(ring)) < 1);
});

test('districtsFrom keeps districts inside the city, attaches holes, drops neighbours, sorts by name', () => {
  const answer = {
    elements: [
      rel(1, 8, 'Miasto', [way(square(18.6, 54.3, 0.1))]),
      rel(2, 9, 'Zaspa', [way(square(18.6, 54.3, 0.05))]),
      rel(3, 9, 'Brzeźno', [
        way(square(18.65, 54.3, 0.05)),
        { type: 'way', role: 'inner', geometry: square(18.66, 54.31, 0.01).map(([lon, lat]) => ({ lon, lat })) },
      ]),
      rel(4, 9, 'Sąsiad', [way(square(18.7, 54.3, 0.05))]), // east of the city: shares its border
      rel(5, 9, undefined, [way(square(18.6, 54.35, 0.05))]), // no name
    ],
  };
  const out = districtsFrom(answer, { city: 8, district: 9 });
  assert.deepEqual(
    out.map((d) => d.name),
    ['Brzeźno', 'Zaspa']
  );
  assert.equal(out[0].id, 'osm-r3');
  assert.equal(out[0].polygons[0].length, 2, 'outer ring and its hole');
  assert.ok(inRing([18.665, 54.315], out[0].polygons[0][1]), 'the hole is where OSM put it');
});

test('districtsFrom fails loudly without the city boundary', () => {
  assert.throws(() => districtsFrom({ elements: [] }, { city: 8, district: 9 }), /no admin_level 8/);
});

test('indexSource has a lazy loader per city, sorted', () => {
  const src = indexSource(['pl-gdansk', 'de-berlin']);
  assert.match(src, /'de-berlin': \(\) => require\('\.\/de-berlin\.json'\) as DistrictFile,\n {2}'pl-gdansk'/);
  assert.doesNotMatch(src, /^import .*\.json/m);
});
