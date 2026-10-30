import { EARTH_RADIUS_M } from '../../../../constants/geo';
import { H3CellGrid } from '../../../../h3';
import {
  assignToDistricts,
  type District,
  districtAreaM2,
  districtBounds,
  districtContains,
  DistrictIndex,
  interiorPoint,
  type Ring,
  ringAreaM2,
  signedRingAreaM2,
} from '../district';

/** A closed square ring [lon, lat], `size` degrees wide, south-west corner at (lon, lat). */
const square = (lon: number, lat: number, size: number): Ring => [
  [lon, lat],
  [lon + size, lat],
  [lon + size, lat + size],
  [lon, lat + size],
  [lon, lat],
];

const district = (id: string, polygons: Ring[][]): District => ({ id, cityId: 'pl-test', name: id, polygons });

describe('district geometry', () => {
  it('measures a square of 0.01° at the equator on the sphere: R² · Δλ · (sin φ₂ − sin φ₁)', () => {
    const exact = EARTH_RADIUS_M ** 2 * ((0.01 * Math.PI) / 180) * Math.sin((0.01 * Math.PI) / 180);
    expect(ringAreaM2(square(0, 0, 0.01))).toBeCloseTo(exact, -1); // 1.2364 km², to 10 m²
    expect(ringAreaM2(square(0, 0, 0.01)) / 1e6).toBeCloseTo(1.2364, 4);
  });

  it('shrinks with the cosine of the latitude (Gdańsk, 54.35° N)', () => {
    const ratio = ringAreaM2(square(18.6, 54.35, 0.01)) / ringAreaM2(square(0, 0, 0.01));
    expect(ratio).toBeCloseTo(Math.cos((54.355 * Math.PI) / 180), 4);
  });

  it('agrees with H3 cell areas: a cell outline measures as H3 measures the cell', () => {
    const grid = new H3CellGrid();
    for (const res11 of [grid.cellOf({ lat: 54.3485, lon: 18.6533 }), grid.cellOf({ lat: 52.2297, lon: 21.0122 })]) {
      const ring: Ring = grid.boundary(res11).map((p): [number, number] => [p.lon, p.lat]);
      const closed: Ring = [...ring, ring[0]];
      expect(ringAreaM2(closed) / grid.areaM2(res11)).toBeCloseTo(1, 4);
    }
  });

  it('agrees with H3 over a district: the cells whose centre lies in it add up to its area', () => {
    // A block of about 1.2 km × 2 km in Gdańsk, polyfilled at res 11 the way GetDistrictCoverage counts turf.
    const grid = new H3CellGrid();
    const block = district('block', [[square(18.64, 54.34, 0.018)]]);
    const cells = new Set<string>();
    for (let lon = 18.6395; lon <= 18.6585; lon += 0.0001) {
      for (let lat = 54.3395; lat <= 54.3585; lat += 0.0001) {
        cells.add(grid.cellOf({ lat, lon }));
      }
    }
    let m2 = 0;
    for (const c of cells) {
      const { lat, lon } = grid.centroid(c);
      if (districtContains(block, lon, lat)) {
        m2 += grid.areaM2(c);
      }
    }
    // Only the cells along the edge make the difference: well within 1 %, no bias of its own.
    expect(m2 / districtAreaM2(block)).toBeGreaterThan(0.99);
    expect(m2 / districtAreaM2(block)).toBeLessThan(1.01);
  });

  it('signs the area by winding: counter-clockwise (RFC 7946 outer ring) positive', () => {
    const ccw = square(18.6, 54.3, 0.01);
    expect(signedRingAreaM2(ccw)).toBeGreaterThan(0);
    expect(signedRingAreaM2([...ccw].reverse())).toBeCloseTo(-signedRingAreaM2(ccw), 6);
  });

  it('is the same area whichever way the ring winds', () => {
    const ring = square(0, 0, 0.01);
    expect(ringAreaM2([...ring].reverse())).toBeCloseTo(ringAreaM2(ring), 6);
  });

  it('subtracts holes and adds exclaves', () => {
    const withHole = district('a', [[square(0, 0, 0.02), square(0.005, 0.005, 0.01)]]);
    expect(districtAreaM2(withHole)).toBeCloseTo(ringAreaM2(square(0, 0, 0.02)) - ringAreaM2(square(0, 0, 0.01)), 0);
    const twoParts = district('b', [[square(0, 0, 0.01)], [square(1, 1, 0.01)]]);
    expect(districtAreaM2(twoParts)).toBeCloseTo(ringAreaM2(square(0, 0, 0.01)) + ringAreaM2(square(1, 1, 0.01)), 3);
  });

  it('contains points inside, not in a hole, not outside', () => {
    const d = district('a', [[square(0, 0, 0.02), square(0.005, 0.005, 0.01)]]);
    expect(districtContains(d, 0.001, 0.001)).toBe(true);
    expect(districtContains(d, 0.01, 0.01)).toBe(false); // in the hole
    expect(districtContains(d, 0.03, 0.01)).toBe(false);
  });

  it('bounds every polygon', () => {
    const d = district('a', [[square(0, 0, 0.01)], [square(1, 1, 0.01)]]);
    expect(districtBounds(d)).toEqual([0, 0, 1.01, 1.01]);
  });

  it('finds a point strictly inside a concave ring, where the centroid would fall outside', () => {
    // A U: two arms joined at the bottom; the vertex average lies in the gap between the arms.
    const u: Ring = [
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
    const d = district('u', [[u]]);
    const pt = interiorPoint([u]);
    expect(pt).not.toBeNull();
    const [lon, lat] = pt!;
    expect(districtContains(d, lon, lat)).toBe(true);
    // Strictly inside: a step of about 10 cm in any direction stays inside.
    for (const [dx, dy] of [
      [1e-6, 0],
      [-1e-6, 0],
      [0, 1e-6],
      [0, -1e-6],
    ]) {
      expect(districtContains(d, lon + dx, lat + dy)).toBe(true);
    }
  });

  it('keeps the interior point out of a hole, and answers null for a ring with no area', () => {
    const outer = square(0, 0, 0.03);
    const hole = square(0.005, 0.005, 0.02);
    const [lon, lat] = interiorPoint([outer, hole])!;
    expect(districtContains(district('h', [[outer, hole]]), lon, lat)).toBe(true);
    expect(
      interiorPoint([
        [
          [0, 0],
          [1, 1],
          [0, 0],
        ],
      ])
    ).toBeNull();
  });

  it('the index answers exactly what testing every district in order answers', () => {
    const ds = [
      district('west', [[square(0, 0, 0.01)]]),
      district('east', [[square(0.01, 0, 0.01)]]),
      district('overlap', [[square(0.005, 0.005, 0.02)]]),
      district('holed', [[square(0.02, 0.02, 0.02), square(0.025, 0.025, 0.005)]]),
    ];
    const index = new DistrictIndex(ds);
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 0.05 - 0.005;
    for (let k = 0; k < 5000; k++) {
      const [lon, lat] = [rand(), rand()];
      expect([lon, lat, index.locate(lon, lat)]).toEqual([
        lon,
        lat,
        ds.findIndex((d) => districtContains(d, lon, lat)),
      ]);
    }
  });

  it('assigns each point to one district at most, the first that holds it', () => {
    const west = district('west', [[square(0, 0, 0.01)]]);
    const east = district('east', [[square(0.01, 0, 0.01)]]);
    const overlap = district('overlap', [[square(0, 0, 0.02)]]);
    expect(
      assignToDistricts(
        [west, east, overlap],
        [
          [0.005, 0.005],
          [0.015, 0.005],
          [0.015, 0.015],
          [0.5, 0.5],
        ]
      )
    ).toEqual([0, 1, 2, -1]);
  });
});
