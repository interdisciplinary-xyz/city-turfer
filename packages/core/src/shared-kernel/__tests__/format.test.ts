import {
  decimalMark,
  distanceText,
  fixed,
  formatArea,
  formatDistance,
  formatDuration,
  formatPaceOrSpeed,
} from '../format';

describe('decimalMark and fixed', () => {
  it('reads the mark from Intl, falls back to a dot', () => {
    expect(decimalMark('en')).toBe('.');
    expect(decimalMark('pl')).toBe(',');
    expect(decimalMark('not a locale!')).toBe('.');
  });

  it('matches toFixed digit for digit in English, ties and all', () => {
    for (const n of [0, 0.005, 0.125, 1.005, 2.675, 9.995, 12.345, 99_999.95, -0, -1.25]) {
      expect(fixed(n, 2, 'en')).toBe(n.toFixed(2));
    }
  });

  it('only swaps the mark in Polish, never groups', () => {
    expect(fixed(2.5, 2, 'pl')).toBe('2,50');
    expect(fixed(1_234_567.89, 1, 'pl')).toBe('1234567,9');
    expect(fixed(12, 0, 'pl')).toBe('12');
  });
});

describe('distance', () => {
  it('metres under 1 km, km with 2 decimals, 1 decimal from 100 km', () => {
    expect(formatDistance(950, 'en')).toEqual({ value: '950', unit: 'm' });
    expect(formatDistance(999.6, 'en')).toEqual({ value: '1000', unit: 'm' });
    expect(formatDistance(2500, 'en')).toEqual({ value: '2.50', unit: 'km' });
    expect(formatDistance(2500, 'pl')).toEqual({ value: '2,50', unit: 'km' });
    expect(formatDistance(123_400, 'en')).toEqual({ value: '123.4', unit: 'km' });
    expect(formatDistance(123_400, 'pl')).toEqual({ value: '123,4', unit: 'km' });
    expect(formatDistance(1_234_567, 'en')).toEqual({ value: '1234.6', unit: 'km' });
  });

  it('as text', () => {
    expect(distanceText(2500, 'en')).toBe('2.50 km');
    expect(distanceText(2500, 'pl')).toBe('2,50 km');
    expect(distanceText(950, 'pl')).toBe('950 m');
  });
});

describe('duration', () => {
  it('m:ss, h:mm:ss from an hour, clamped at zero', () => {
    expect(formatDuration(333)).toBe('5:33');
    expect(formatDuration(3723)).toBe('1:02:03');
    expect(formatDuration(59.6)).toBe('1:00');
    expect(formatDuration(-5)).toBe('0:00');
  });
});

describe('pace or speed', () => {
  it('pace for walk and run', () => {
    expect(formatPaceOrSpeed('run', 1000, 333, 'en')).toEqual({ value: '5:33', unit: '/km' });
    expect(formatPaceOrSpeed('walk', 5000, 1665, 'pl')).toEqual({ value: '5:33', unit: '/km' });
  });

  it('— under 50 m, with no time, or slower than 1 h/km', () => {
    expect(formatPaceOrSpeed('walk', 49, 60, 'en')).toEqual({ value: '—', unit: '/km' });
    expect(formatPaceOrSpeed('run', 1000, 0, 'en')).toEqual({ value: '—', unit: '/km' });
    expect(formatPaceOrSpeed('walk', 1000, 3600, 'en')).toEqual({ value: '1:00:00', unit: '/km' });
    expect(formatPaceOrSpeed('walk', 1000, 3601, 'en')).toEqual({ value: '—', unit: '/km' });
  });

  it('km/h for cycle, — with no time', () => {
    expect(formatPaceOrSpeed('cycle', 20_000, 3600, 'en')).toEqual({ value: '20.0', unit: 'km/h' });
    expect(formatPaceOrSpeed('cycle', 25_500, 3600, 'pl')).toEqual({ value: '25,5', unit: 'km/h' });
    expect(formatPaceOrSpeed('cycle', 10, 0, 'en')).toEqual({ value: '—', unit: 'km/h' });
  });
});

describe('area', () => {
  it('km² with 2 decimals, m² under 0.01 km², never grouped', () => {
    expect(formatArea(2.5, 'en')).toBe('2.50 km²');
    expect(formatArea(2.5, 'pl')).toBe('2,50 km²');
    expect(formatArea(1234.5, 'pl')).toBe('1234,50 km²');
    expect(formatArea(0.0099, 'en')).toBe('9900 m²');
  });
});
