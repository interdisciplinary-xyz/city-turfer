import type { DistrictsView } from '../../contract';
import { districtAt } from '../district-at';
import { type DistrictsState, readDistricts } from '../read-districts';
import { spokenArea } from '../spoken-area';

/** Two squares sharing the border at lon 1; the west one has a hole around (0.5, 0.5). */
const west = {
  id: 'west',
  bounds: [0, 0, 1, 1] as [number, number, number, number],
  polygons: [
    [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
      [
        [0.4, 0.4],
        [0.6, 0.4],
        [0.6, 0.6],
        [0.4, 0.6],
        [0.4, 0.4],
      ],
    ],
  ] as [number, number][][][],
};
const east = {
  id: 'east',
  bounds: [1, 0, 2, 1] as [number, number, number, number],
  polygons: [
    [
      [
        [1, 0],
        [2, 0],
        [2, 1],
        [1, 1],
        [1, 0],
      ],
    ],
  ] as [number, number][][][],
};

describe('districtAt', () => {
  it('picks the district whose boundary holds the point, on either side of a shared border', () => {
    expect(districtAt([west, east], 0.999, 0.5)).toBe('west');
    expect(districtAt([west, east], 1.001, 0.5)).toBe('east');
    // Order does not decide it: the neighbour listed first is skipped.
    expect(districtAt([east, west], 0.999, 0.5)).toBe('west');
  });

  it('returns null outside every district and in a hole', () => {
    expect(districtAt([west, east], 3, 0.5)).toBeNull();
    expect(districtAt([west, east], 0.5, 0.5)).toBeNull();
  });
});

describe('spokenArea', () => {
  it('switches to square metres below 0.01 km², like formatArea', () => {
    expect(spokenArea(0.0042, 'en')).toEqual({ unit: 'm2', count: 4200, text: '4200' });
    expect(spokenArea(0, 'en')).toEqual({ unit: 'm2', count: 0, text: '0' });
  });

  it('drops trailing zeros, so the plural follows what is read out', () => {
    expect(spokenArea(2, 'en')).toEqual({ unit: 'km2', count: 2, text: '2' });
    expect(spokenArea(1.5, 'pl')).toEqual({ unit: 'km2', count: 1.5, text: '1,5' });
    expect(spokenArea(0.3, 'en')).toEqual({ unit: 'km2', count: 0.3, text: '0.3' });
    expect(spokenArea(5.834, 'en')).toEqual({ unit: 'km2', count: 5.83, text: '5.83' });
  });
});

describe('readDistricts (useDistricts)', () => {
  const ready = { status: 'no-city' } as DistrictsView;
  const flush = () => new Promise((r) => setTimeout(r, 0));
  /** Runs the reads against one piece of state, like useState. */
  function state(initial: DistrictsState) {
    let v = initial;
    return {
      get: () => v,
      set: (f: (cur: DistrictsState) => DistrictsState) => {
        v = f(v);
      },
    };
  }

  it('shows the answer', async () => {
    const s = state(undefined);
    readDistricts(() => Promise.resolve(ready), s.set);
    await flush();
    expect(s.get()).toBe(ready);
  });

  it('a failure with nothing shown gives null (the failed state)', async () => {
    const s = state(undefined);
    readDistricts(() => Promise.reject(new Error('boom')), s.set);
    await flush();
    expect(s.get()).toBeNull();
  });

  it('a use case that throws synchronously is a failure too', async () => {
    const s = state(undefined);
    readDistricts(() => {
      throw new Error('boundaries failed to load');
    }, s.set);
    await flush();
    expect(s.get()).toBeNull();
  });

  it('a failed re-read keeps the earlier answer', async () => {
    const s = state(ready);
    readDistricts(() => Promise.reject(new Error('boom')), s.set);
    await flush();
    expect(s.get()).toBe(ready);
  });

  it('a re-read replaces the answer (dataVersion, a Home City choice)', async () => {
    const s = state(ready);
    const next = { status: 'no-city' } as DistrictsView;
    readDistricts(() => Promise.resolve(next), s.set);
    await flush();
    expect(s.get()).toBe(next);
  });

  it('a read cancelled by the effect cleanup changes nothing', async () => {
    const s = state(undefined);
    const cancel = readDistricts(() => Promise.resolve(ready), s.set);
    cancel();
    await flush();
    expect(s.get()).toBeUndefined();
  });
});
