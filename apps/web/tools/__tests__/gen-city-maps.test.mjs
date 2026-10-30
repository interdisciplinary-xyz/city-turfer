import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  assembleRings,
  CANVAS,
  clipLine,
  clipRing,
  pathData,
  projector,
  readCatalog,
  renderCity,
  simplify,
} from '../gen-city-maps.mjs';

const CENTER = { id: 'xx-test', lat: 54.35, lon: 18.65 };
const BOX = { x0: 0, y0: 0, x1: 100, y1: 100 };

describe('gen-city-maps', () => {
  test('reads cities from the catalogue source', () => {
    const src =
      "city('pl-gdansk', 'Gdańsk', 'PL', 54.3485, 18.6533, 9),\n  city('gb-london', 'London', 'GB', 51.5074, -0.1278, 15),";
    const cities = readCatalog(src);
    assert.deepEqual(cities.get('gb-london'), { id: 'gb-london', name: 'London', lat: 51.5074, lon: -0.1278 });
    assert.equal(cities.size, 2);
  });

  test('projects the centre to the middle and north up', () => {
    const p = projector(CENTER);
    assert.deepEqual(p(CENTER), [CANVAS.width / 2, CANVAS.height / 2]);
    const [, yNorth] = p({ lat: CENTER.lat + 0.001, lon: CENTER.lon });
    assert.ok(Math.abs(CANVAS.height / 2 - yNorth - 111.32 / CANVAS.metresPerPx) < 0.01);
  });

  test('simplify drops points on a straight line and keeps corners', () => {
    assert.deepEqual(
      simplify([
        [0, 0],
        [5, 0.2],
        [10, 0],
        [10, 10],
      ]),
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ]
    );
  });

  test('clipLine keeps only the runs that touch the box', () => {
    const runs = clipLine(
      [
        [-50, 50],
        [-20, 50],
        [10, 50],
        [130, 50],
        [200, 50],
      ],
      BOX
    );
    assert.deepEqual(runs, [
      [
        [-20, 50],
        [10, 50],
        [130, 50],
      ],
    ]);
  });

  test('clipRing cuts a polygon to the box', () => {
    const ring = clipRing(
      [
        [-50, -50],
        [50, -50],
        [50, 50],
        [-50, 50],
      ],
      BOX
    );
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [0, 50, 0, 50]);
    assert.deepEqual(
      clipRing(
        [
          [200, 200],
          [300, 200],
          [300, 300],
        ],
        BOX
      ),
      []
    );
  });

  test('assembleRings joins fragments in any direction', () => {
    const a = { lat: 0, lon: 0 };
    const b = { lat: 0, lon: 1 };
    const c = { lat: 1, lon: 1 };
    const rings = assembleRings([
      [a, b],
      [a, c], // reversed
      [b, c],
    ]);
    assert.equal(rings.length, 1);
    assert.deepEqual(rings[0][0], rings[0].at(-1));
  });

  test('pathData writes whole-pixel relative lines', () => {
    assert.equal(
      pathData([
        [0.4, 0],
        [10, 0],
        [10, -5.6],
      ]),
      'M0 0l10 0 0-6'
    );
    assert.equal(pathData([[1, 1]]), '');
  });

  test('renderCity draws streets and water as colourless masks', () => {
    const osm = {
      elements: [
        {
          type: 'way',
          tags: { highway: 'residential' },
          geometry: [CENTER, { lat: CENTER.lat, lon: CENTER.lon + 0.01 }],
        },
        {
          type: 'way',
          tags: { natural: 'water' },
          geometry: [
            CENTER,
            { lat: CENTER.lat + 0.002, lon: CENTER.lon },
            { lat: CENTER.lat + 0.002, lon: CENTER.lon + 0.002 },
            CENTER,
          ],
        },
        { type: 'way', tags: { highway: 'footway' }, geometry: [CENTER, { lat: CENTER.lat, lon: 18.7 }] },
      ],
    };
    const { streets, water } = renderCity(CENTER, osm);
    assert.match(streets, /stroke-width="2.2"/);
    assert.equal((streets.match(/<path /g) ?? []).length, 1, 'footways are left out');
    assert.match(water, /fill-rule="evenodd"/);
    assert.match(streets, /OpenStreetMap contributors/);
    assert.doesNotMatch(streets + water, /#[0-9a-f]{3,8}\b/i);
  });

  test('renderCity can leave street types out (over-budget fallback)', () => {
    const osm = {
      elements: [
        {
          type: 'way',
          tags: { highway: 'pedestrian' },
          geometry: [CENTER, { lat: CENTER.lat, lon: CENTER.lon + 0.01 }],
        },
      ],
    };
    assert.match(renderCity(CENTER, osm).streets, /<path /);
    assert.doesNotMatch(renderCity(CENTER, osm, CANVAS, { skip: ['pedestrian'] }).streets, /<path /);
  });
});
