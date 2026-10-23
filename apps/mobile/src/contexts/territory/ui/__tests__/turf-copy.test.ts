import { translator } from '@/i18n/translator';
import { fixed } from '@/ui-kit/format';

const summary = (locale: 'en' | 'pl', cells: number, strong: number) =>
  translator('turf', locale)('summary', {
    cellCount: cells,
    cells: fixed(cells, 0, locale),
    strongCount: strong,
    strong: fixed(strong, 0, locale),
    area: '0.05 km²',
  });

describe('turf copy', () => {
  it('matches the Maestro summary pattern with ungrouped counts (e2e/06)', () => {
    expect(summary('en', 12345, 22)).toBe('12345 cells · 22 strong · +0.05 km² this week');
    expect(summary('en', 12345, 22)).toMatch(/^[0-9]+ cells · [0-9]+ strong.*/);
    expect(summary('en', 1, 1)).toBe('1 cell · 1 strong · +0.05 km² this week');
  });

  it('declines cells in Polish: one, few, many', () => {
    expect(summary('pl', 1, 1)).toMatch(/^1 komórka · 1 mocna/);
    expect(summary('pl', 22, 3)).toMatch(/^22 komórki · 3 mocne/);
    expect(summary('pl', 1530, 5)).toMatch(/^1530 komórek · 5 mocnych · \+0.05 km² w tym tygodniu$/);
  });

  it('writes the turf gained card as the flows expect (e2e/02)', () => {
    const t = translator('turf', 'en');
    expect(t('gained.newTurf', { area: '0.02 km²' })).toMatch(/\+.* new turf/);
    expect(t('gained.cells', { addedCount: 40, added: '40', reinforcedCount: 2, reinforced: '2' })).toBe(
      '40 new cells · 2 reinforced'
    );
  });
});
