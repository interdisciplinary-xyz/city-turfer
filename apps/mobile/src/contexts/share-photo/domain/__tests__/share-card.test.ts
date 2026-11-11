import { hasNewTurf, placeChoices, placeLine, shareCardContent, type ShareCardFormat } from '../share-card';

/** Readable stand-ins: the real formatters are checked in ui/__tests__/share-card-format.test.ts. */
const FORMAT: ShareCardFormat = {
  distance: (m) => ({ value: (m / 1000).toFixed(2), unit: 'km' }),
  duration: (s) => `${s}s`,
  paceOrSpeed: (type) => (type === 'cycle' ? { value: 'SPEED', unit: 'km/h' } : { value: 'PACE', unit: '/km' }),
  day: () => 'DAY',
  time: () => 'TIME',
  label: (k) => k.toUpperCase(),
  turfCells: (n) => `+${n} cells`,
  when: (d, t) => `${d} · ${t}`,
  placeDistrict: (d, c) => `${d}, ${c}`,
};

const RUN = { type: 'run' as const, name: 'Evening run', startedAt: 0, distanceM: 5740, movingS: 2084 };
const OPTIONS = { layout: 'top' as const, showTurf: true, place: 'off' as const };
const GDANSK = { city: 'Gdańsk', district: 'Oliwa' };

describe('shareCardContent', () => {
  it('shows distance, moving time and pace for a walk or run', () => {
    for (const type of ['walk', 'run'] as const) {
      const c = shareCardContent({ ...RUN, type }, 128, null, OPTIONS, FORMAT);
      expect(c.stats).toEqual([
        { label: 'DISTANCE', value: '5.74', unit: 'km' },
        { label: 'MOVINGTIME', value: '2084s' },
        { label: 'PACE', value: 'PACE', unit: '/km' },
      ]);
      expect(c.type).toBe(type);
    }
  });

  it('shows speed for a ride', () => {
    const c = shareCardContent({ ...RUN, type: 'cycle' }, 0, null, OPTIONS, FORMAT);
    expect(c.stats[2]).toEqual({ label: 'SPEED', value: 'SPEED', unit: 'km/h' });
  });

  it('carries the name, date and start time, and the layout', () => {
    const c = shareCardContent(RUN, 0, null, { ...OPTIONS, layout: 'bottom' }, FORMAT);
    expect(c).toMatchObject({ title: 'Evening run', when: 'DAY · TIME', layout: 'bottom' });
  });

  it('shows the turf line only with new cells and the toggle on', () => {
    expect(shareCardContent(RUN, 128, null, OPTIONS, FORMAT).turfCells).toBe('+128 cells');
    expect(shareCardContent(RUN, 0, null, OPTIONS, FORMAT).turfCells).toBeNull();
    expect(shareCardContent(RUN, null, null, OPTIONS, FORMAT).turfCells).toBeNull();
    expect(shareCardContent(RUN, 128, null, { ...OPTIONS, showTurf: false }, FORMAT).turfCells).toBeNull();
  });

  it('place: Off by choice, City, District as "district, city"', () => {
    const place = (choice: 'off' | 'city' | 'district') =>
      shareCardContent(RUN, 0, GDANSK, { ...OPTIONS, place: choice }, FORMAT).place;
    expect(place('off')).toBeNull();
    expect(place('city')).toBe('Gdańsk');
    expect(place('district')).toBe('Oliwa, Gdańsk');
  });
});

describe('place rules', () => {
  it('District falls back to City without district data', () => {
    expect(placeLine('district', { city: 'Gdańsk', district: null }, FORMAT)).toBe('Gdańsk');
  });

  it('no known city: no place line and no City or District choice', () => {
    expect(placeLine('city', { city: null, district: null }, FORMAT)).toBeNull();
    expect(placeLine('district', undefined, FORMAT)).toBeNull();
    expect(placeChoices({ city: null, district: null })).toEqual(['off']);
    expect(placeChoices(undefined)).toEqual(['off']);
  });

  it('a known city offers Off, City and District (District falls back)', () => {
    expect(placeChoices({ city: 'Gdańsk', district: null })).toEqual(['off', 'city', 'district']);
  });
});

it('hasNewTurf', () => {
  expect(hasNewTurf(3)).toBe(true);
  expect(hasNewTurf(0)).toBe(false);
  expect(hasNewTurf(null)).toBe(false);
});
