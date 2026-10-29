import {
  assignToDistricts,
  type District,
  districtAreaM2,
  districtBounds,
  districtContains,
  type Ring,
  ringAreaM2,
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
  it('measures a square of 0.01° at the equator as about 1.23 km² (111.32 m × 110.54 m per 0.001°)', () => {
    expect(ringAreaM2(square(0, 0, 0.01)) / 1e6).toBeCloseTo(1.2305, 3);
  });

  it('shrinks with the cosine of the latitude (Gdańsk, 54.35° N)', () => {
    const ratio = ringAreaM2(square(18.6, 54.35, 0.01)) / ringAreaM2(square(0, 0, 0.01));
    expect(ratio).toBeCloseTo(Math.cos((54.35 * Math.PI) / 180), 4);
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
