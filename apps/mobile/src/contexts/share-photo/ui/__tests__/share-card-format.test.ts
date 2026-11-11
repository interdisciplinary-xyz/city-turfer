import { resetLanguageStateForTests } from '@/i18n/language-state';

import { shareCardContent } from '../../index';
import { shareCardFormat } from '../share-card-format';

beforeEach(() => resetLanguageStateForTests('en-GB'));

// 2026-11-09 17:36 local time.
const AT = new Date(2026, 10, 9, 17, 36).getTime();
const RUN = { type: 'run' as const, name: 'Evening run', startedAt: AT, distanceM: 5740, movingS: 2084 };
const OLIWA = { city: 'Gdańsk', district: 'Oliwa' };

describe('the card in English', () => {
  it('matches the activity screen formatters', () => {
    const c = shareCardContent(
      RUN,
      128,
      OLIWA,
      { layout: 'top', showTurf: true, place: 'district' },
      shareCardFormat('en', 'en-GB')
    );
    expect(c).toEqual({
      title: 'Evening run',
      type: 'run',
      stats: [
        { label: 'Distance', value: '5.74', unit: 'km' },
        { label: 'Moving time', value: '34:44' },
        { label: 'Avg pace', value: '6:03', unit: '/km' },
      ],
      turfCells: '+128 new turf cells',
      when: '9 Nov 2026 · 17:36',
      place: 'Oliwa, Gdańsk',
      layout: 'top',
    });
  });

  it('one cell, and speed for a ride', () => {
    const f = shareCardFormat('en', 'en-GB');
    const c = shareCardContent(
      { ...RUN, type: 'cycle', distanceM: 102_350, movingS: 5684 },
      1,
      null,
      { layout: 'bottom', showTurf: true, place: 'off' },
      f
    );
    expect(c.turfCells).toBe('+1 new turf cell');
    expect(c.stats[0]).toEqual({ label: 'Distance', value: '102.3', unit: 'km' });
    expect(c.stats[1].value).toBe('1:34:44');
    expect(c.stats[2]).toMatchObject({ label: 'Avg speed', unit: 'km/h' });
  });
});

describe('the card in Polish', () => {
  const f = () => shareCardFormat('pl', 'pl');

  it('labels, decimal comma and date', () => {
    const c = shareCardContent(RUN, 0, OLIWA, { layout: 'top', showTurf: true, place: 'city' }, f());
    expect(c.stats).toEqual([
      { label: 'Dystans', value: '5,74', unit: 'km' },
      { label: 'Czas w ruchu', value: '34:44' },
      { label: 'Śr. tempo', value: '6:03', unit: '/km' },
    ]);
    expect(c.when).toBe('9 lis 2026 · 17:36');
    expect(c.place).toBe('Gdańsk');
    expect(c.turfCells).toBeNull();
  });

  it('turf cells in every Polish plural form', () => {
    const line = (n: number) =>
      shareCardContent(RUN, n, null, { layout: 'top', showTurf: true, place: 'off' }, f()).turfCells;
    expect(line(1)).toBe('+1 nowa komórka terytorium');
    expect(line(2)).toBe('+2 nowe komórki terytorium');
    expect(line(5)).toBe('+5 nowych komórek terytorium');
    expect(line(22)).toBe('+22 nowe komórki terytorium');
    expect(line(12)).toBe('+12 nowych komórek terytorium');
  });

  it('speed for a ride', () => {
    const c = shareCardContent(
      { ...RUN, type: 'cycle' },
      0,
      null,
      { layout: 'top', showTurf: true, place: 'off' },
      f()
    );
    expect(c.stats[2]).toMatchObject({ label: 'Śr. prędkość', unit: 'km/h' });
    expect(c.stats[2].value).toMatch(/,/);
  });
});
