import { applyLanguageSetting, resetLanguageStateForTests } from '@/i18n/language-state';

import {
  decimalMark,
  distanceText,
  fixed,
  formatArea,
  formatDate,
  formatDay,
  formatDistance,
  formatDuration,
  formatPaceOrSpeed,
  formatSpeedNow,
} from '../format';

beforeEach(() => resetLanguageStateForTests('en-US'));

// 2026-10-22 09:05 local time (formatters use the phone's time zone).
const MS = new Date(2026, 9, 22, 9, 5).getTime();

describe('format.ts in English (byte-identical to the toFixed output the Maestro flows match)', () => {
  it('distance', () => {
    expect(formatDistance(999.6, 'en')).toEqual({ value: '1000', unit: 'm' });
    expect(formatDistance(2504, 'en')).toEqual({ value: '2.50', unit: 'km' });
    expect(formatDistance(123_456, 'en')).toEqual({ value: '123.5', unit: 'km' });
    expect(formatDistance(1_234_567, 'en')).toEqual({ value: '1234.6', unit: 'km' }); // never grouped
    expect(distanceText(5000, 'en')).toBe('5.00 km');
  });

  it('pace and speed', () => {
    expect(formatPaceOrSpeed('run', 5000, 1560, 'en')).toEqual({ value: '5:12', unit: '/km' });
    expect(formatPaceOrSpeed('cycle', 20_000, 3600, 'en')).toEqual({ value: '20.0', unit: 'km/h' });
    expect(formatPaceOrSpeed('walk', 10, 60, 'en')).toEqual({ value: '—', unit: '/km' });
    expect(formatSpeedNow('cycle', 5.5, 'en')).toEqual({ value: '19.8', unit: 'km/h' });
    expect(formatSpeedNow('run', null, 'en')).toEqual({ value: '—', unit: '/km' });
  });

  it('area, never grouped', () => {
    expect(formatArea(2.5, 'en')).toBe('2.50 km²');
    expect(formatArea(1234.5, 'en')).toBe('1234.50 km²');
    expect(formatArea(0.0099, 'en')).toBe('9900 m²');
  });

  it('matches toFixed digit for digit, ties and all', () => {
    for (const n of [0, 0.005, 0.125, 1.005, 2.675, 9.995, 12.345, 99_999.95, -0, -1.25]) {
      expect(fixed(n, 2, 'en')).toBe(n.toFixed(2));
    }
  });

  it('dates in the regional English variant', () => {
    expect(formatDate(MS, 'en-US')).toBe(
      new Date(MS).toLocaleString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    );
    expect(formatDay(MS, 'en-US')).toBe('Oct 22, 2026');
    expect(formatDay(MS, 'en-GB')).toBe('22 Oct 2026');
  });
});

describe('format.ts in Polish', () => {
  it('distance, pace and speed with a decimal comma and the same unit symbols', () => {
    expect(decimalMark('pl')).toBe(',');
    expect(formatDistance(2504, 'pl')).toEqual({ value: '2,50', unit: 'km' });
    expect(formatDistance(999.6, 'pl')).toEqual({ value: '1000', unit: 'm' });
    expect(formatDistance(123_456, 'pl')).toEqual({ value: '123,5', unit: 'km' });
    expect(distanceText(5000, 'pl')).toBe('5,00 km');
    expect(formatPaceOrSpeed('run', 5000, 1560, 'pl')).toEqual({ value: '5:12', unit: '/km' });
    expect(formatPaceOrSpeed('cycle', 20_000, 3600, 'pl')).toEqual({ value: '20,0', unit: 'km/h' });
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('area without grouping (a Polish space or dot would read wrong)', () => {
    expect(formatArea(2.5, 'pl')).toBe('2,50 km²');
    expect(formatArea(1234.5, 'pl')).toBe('1234,50 km²');
    expect(formatArea(0.0375, 'pl')).toBe('0,04 km²');
    expect(formatArea(0.0099, 'pl')).toBe('9900 m²');
  });

  it('dates in Polish', () => {
    expect(formatDay(MS, 'pl')).toBe('22 paź 2026');
    expect(formatDate(MS, 'pl')).toBe(
      new Intl.DateTimeFormat('pl', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(MS)
    );
    expect(formatDate(MS, 'pl')).toMatch(/^czw\..*22 paź.*09:05$/);
  });
});

describe('format.ts follows the app language', () => {
  it('defaults to the current locale, switching with the setting', () => {
    expect(distanceText(2504)).toBe('2.50 km');
    expect(formatArea(2.5)).toBe('2.50 km²');
    applyLanguageSetting('pl', 'en-US');
    expect(distanceText(2504)).toBe('2,50 km');
    expect(formatSpeedNow('cycle', 5.5).value).toBe('19,8');
    expect(formatDay(MS)).toBe('22 paź 2026');
  });

  it("uses the phone's region for dates when it speaks the app language", () => {
    applyLanguageSetting('system', 'en-GB');
    expect(formatDay(MS)).toBe('22 Oct 2026');
    applyLanguageSetting('en', 'de-DE');
    expect(formatDay(MS)).toBe('Oct 22, 2026');
  });
});
